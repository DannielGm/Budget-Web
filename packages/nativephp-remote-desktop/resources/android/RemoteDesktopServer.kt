package com.bkeeper.remotedesktop

import android.content.Context
import android.net.ConnectivityManager
import android.net.LinkAddress
import android.net.NetworkCapabilities
import com.nativephp.mobile.network.PHPRequest
import com.nativephp.mobile.ui.MainActivity
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.File
import java.net.ServerSocket
import java.nio.charset.StandardCharsets
import java.security.SecureRandom
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

object RemoteDesktopServer {
    private val running = AtomicBoolean(false)
    private var serverSocket: ServerSocket? = null
    private var token = ""
    private var expiresAt = 0L
    private var port = 8080
    private val sessions = ConcurrentHashMap.newKeySet<String>()
    private val random = SecureRandom()

    fun start(context: Context, requestedPort: Int, pairingToken: String, ttlSeconds: Long): Map<String, Any> {
        stop()
        val ip = wifiAddress(context)
            ?: return mapOf("status" to "error", "message" to "Conecta el teléfono a una red Wi-Fi.")
        val requested = requestedPort.coerceIn(1024, 65535)
        val socket = try {
            ServerSocket(requested, 8, java.net.InetAddress.getByName("0.0.0.0"))
        } catch (_: Exception) {
            return mapOf("status" to "error", "message" to "No se pudo abrir el puerto $requested.")
        }
        token = pairingToken
        port = socket.localPort
        expiresAt = System.currentTimeMillis() + ttlSeconds * 1000
        serverSocket = socket
        running.set(true)
        Thread({ acceptLoop(context.applicationContext, socket) }, "remote-desktop-accept").apply { isDaemon = true; start() }
        Thread({
            while (running.get() && System.currentTimeMillis() < expiresAt) Thread.sleep(500)
            if (running.get()) stop()
        }, "remote-desktop-expiry").apply { isDaemon = true; start() }
        return status(context)
    }

    fun stop(): Map<String, Any> {
        if (running.getAndSet(false)) try { serverSocket?.close() } catch (_: Exception) {}
        serverSocket = null
        sessions.clear()
        token = ""
        expiresAt = 0
        return mapOf("active" to false)
    }

    fun status(context: Context? = null): Map<String, Any> {
        if (!running.get()) return mapOf("active" to false)
        val ip = context?.let { wifiAddress(it) } ?: "127.0.0.1"
        return mapOf(
            "active" to true, "ip" to ip, "port" to port, "token" to token,
            "url" to "http://$ip:$port", "expires_at" to expiresAt / 1000,
        )
    }

    private fun acceptLoop(context: Context, socket: ServerSocket) {
        while (running.get() && !socket.isClosed) {
            try { socket.accept().use { handleClient(context, it) } }
            catch (_: Exception) { if (!socket.isClosed) continue else break }
        }
    }


    private fun readAsciiLine(input: BufferedInputStream): String? {
        val bytes = StringBuilder()
        var previous = -1
        var current: Int
        while (input.read().also { current = it } != -1) {
            if (previous == '\r'.code && current == '\n'.code) {
                bytes.setLength(bytes.length - 1)
                return bytes.toString()
            }
            bytes.append(current.toChar())
            previous = current
        }
        return if (bytes.isNotEmpty()) bytes.toString() else null
    }

    private fun handleClient(context: Context, client: java.net.Socket) {
        try {
            client.soTimeout = 15_000
            val input = BufferedInputStream(client.getInputStream())
            val output = BufferedOutputStream(client.getOutputStream())
            val requestLine = readAsciiLine(input)?.takeIf { it.isNotBlank() } ?: return
            val parts = requestLine.split(' ', limit = 3)
            if (parts.size < 2) return
            val method = parts[0].uppercase(Locale.US)
            val target = java.net.URI(parts[1])
            val path = target.path ?: "/"
            val query = target.rawQuery ?: ""
            val headers = mutableMapOf<String, String>()
            while (true) {
                val line = readAsciiLine(input) ?: break
                if (line.isEmpty()) break
                val index = line.indexOf(':')
                if (index > 0) headers[line.substring(0, index).trim()] = line.substring(index + 1).trim()
            }
            val length = headers["Content-Length"]?.toIntOrNull()?.coerceIn(0, 12 * 1024 * 1024) ?: 0
            val body = if (length > 0) input.readNBytes(length).toString(StandardCharsets.UTF_8) else ""
            val cookie = headers["Cookie"].orEmpty().split(';').map { it.trim() }
                .firstOrNull { it.startsWith("remote_desktop=") }?.substringAfter('=')

            if (!isPaired(cookie)) {
                if (method == "POST" && path == "/remote-desktop/pair" && pairFrom(body) == token) {
                    val session = randomSession()
                    sessions.add(session)
                    writeResponse(output, 303, mapOf(
                        "Location" to "/",
                        "Set-Cookie" to "remote_desktop=$session; Path=/; HttpOnly; SameSite=Lax; Max-Age=900",
                        "Content-Type" to "text/html; charset=utf-8",
                    ), "Conectado")
                } else {
                    writeResponse(output, 200, mapOf("Content-Type" to "text/html; charset=utf-8"), pairingPage(method == "POST"))
                }
                return
            }
            if (System.currentTimeMillis() >= expiresAt) {
                stop()
                writeResponse(output, 410, mapOf("Content-Type" to "text/plain; charset=utf-8"), "La conexión expiró.")
                return
            }
            // Management endpoints and the pairing token are phone-only. The
            // phone UI reaches them directly through its WebView, never through
            // this LAN listener, so reject them from every remote client.
            if (path == "/remote-desktop" || path.startsWith("/remote-desktop/")) {
                writeResponse(output, 404, mapOf("Content-Type" to "text/plain; charset=utf-8"), "No encontrado.")
                return
            }

            val activity = MainActivity.instance
            if (activity == null) {
                writeResponse(output, 503, mapOf("Content-Type" to "text/plain; charset=utf-8"), "La aplicación no está lista.")
                return
            }
            if (serveStatic(activity.phpBridge.getLaravelPublicPath(), path, output)) return

            val ip = wifiAddress(context) ?: "127.0.0.1"
            val origin = "http://$ip:$port"
            val phpHeaders = headers.filterKeys { !it.equals("Host", true) && !it.equals("Connection", true) }.toMutableMap()
            phpHeaders["Host"] = "$ip:$port"
            phpHeaders["X-Forwarded-Host"] = "$ip:$port"
            phpHeaders["X-Forwarded-Proto"] = "http"
            val request = PHPRequest(path, method, body, phpHeaders, queryString = query)
            val raw = activity.phpBridge.handleLaravelRequest(request, headers["Cookie"].orEmpty())
            if (raw.isBlank()) {
                // A blank upstream response used to reach the browser as a white
                // page; surface it instead so the failure is diagnosable.
                writeResponse(output, 502, mapOf("Content-Type" to "text/html; charset=utf-8"),
                    errorPage("El servidor no devolvió una respuesta", "$method $path"))
            } else {
                writeRawResponse(output, raw, origin)
            }
        } catch (_: Exception) {
        } finally {
            try { client.close() } catch (_: Exception) {}
        }
    }

    private fun isPaired(cookie: String?): Boolean {
        val session = cookie?.removePrefix("remote_desktop=")?.takeIf { it.isNotBlank() } ?: return false
        return sessions.contains(session)
    }

    private fun pairFrom(body: String): String? =
        Regex("(?:^|&)code=([^&]+)").find(body)?.groupValues?.get(1)
            ?.let { java.net.URLDecoder.decode(it, "UTF-8") }

    private fun randomSession(): String =
        android.util.Base64.encodeToString(ByteArray(24).also { random.nextBytes(it) }, android.util.Base64.NO_WRAP or android.util.Base64.NO_PADDING)

    private fun serveStatic(publicRoot: String, path: String, output: BufferedOutputStream): Boolean {
        val relative = path.removePrefix("/").substringBefore('?')
        if (relative.isBlank() || relative.contains("..")) return false
        val root = File(publicRoot).canonicalFile
        // Mirror the phone WebView's resolution: the requested path first, then
        // the vendor/build fallbacks it uses for Vite output.
        val candidates = listOf("$root/$relative", "$root/vendor/$relative", "$root/build/$relative")
        val file = candidates
            .map { File(it).canonicalFile }
            .firstOrNull { it.path.startsWith(root.path + File.separator) && it.isFile }
            ?: return false
        val mime = when (file.extension.lowercase()) {
            "js", "mjs" -> "text/javascript; charset=utf-8"
            "css" -> "text/css; charset=utf-8"
            "json", "map" -> "application/json; charset=utf-8"
            "svg" -> "image/svg+xml"; "png" -> "image/png"; "jpg", "jpeg" -> "image/jpeg"
            "webp" -> "image/webp"; "gif" -> "image/gif"; "ico" -> "image/x-icon"
            "woff2" -> "font/woff2"; "woff" -> "font/woff"; "ttf" -> "font/ttf"
            "eot" -> "application/vnd.ms-fontobject"; "html" -> "text/html; charset=utf-8"
            "txt" -> "text/plain; charset=utf-8"
            else -> "application/octet-stream"
        }
        val head = buildString {
            append("HTTP/1.1 200 OK\r\n")
            append("Content-Type: $mime\r\n")
            append("Content-Length: ${file.length()}\r\n")
            append("Cache-Control: max-age=86400, public\r\n")
            if (mime.startsWith("font/") || file.extension.lowercase() == "eot") {
                append("Access-Control-Allow-Origin: *\r\n")
            }
            append("Connection: close\r\n\r\n")
        }
        output.write(head.toByteArray(StandardCharsets.US_ASCII))
        file.inputStream().use { it.copyTo(output) }
        output.flush()
        return true
    }

    private fun pairingPage(submitted: Boolean): String = """<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Escritorio remoto · BKeeper</title><style>body{font:16px system-ui;background:#0d0d12;color:#f8fafc;display:grid;min-height:100vh;margin:0;place-items:center}.card{width:min(360px,calc(100% - 32px));background:#1a1a2e;border:1px solid #2d2d44;border-radius:20px;padding:28px;box-sizing:border-box}h1{font-size:22px;margin:0 0 8px}p{color:#9ca3af;line-height:1.5}label{display:block;font-size:11px;letter-spacing:.12em;text-transform:uppercase;margin:24px 0 8px;color:#9ca3af}input,button{box-sizing:border-box;width:100%;border-radius:12px;padding:13px;font:inherit}input{background:#0d0d12;border:1px solid #374151;color:white;letter-spacing:.12em;text-transform:uppercase}button{margin-top:12px;background:#9b7bff;color:white;border:0;font-weight:700}.err{color:#fca5a5;font-size:13px}</style><div class="card"><h1>Escritorio remoto</h1><p>Introduce el código temporal que aparece en BKeeper.</p><form method="post" action="/remote-desktop/pair"><label>Código de acceso</label><input name="code" required autofocus autocomplete="one-time-code" inputmode="text" pattern="[A-Za-z0-9-]{6,20}">${if (submitted) "<p class=err>El código no coincide o venció.</p>" else ""}<button>Conectar</button></form><p>La conexión se cerrará automáticamente después de 15 minutos.</p></div></html>"""

    private fun errorPage(title: String, detail: String): String = """<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Escritorio remoto</title><style>body{font:16px system-ui;background:#0d0d12;color:#f8fafc;display:grid;min-height:100vh;margin:0;place-items:center}.card{width:min(420px,calc(100% - 32px));background:#1a1a2e;border:1px solid #2d2d44;border-radius:20px;padding:28px;box-sizing:border-box}h1{font-size:20px;margin:0 0 10px}p{color:#9ca3af;line-height:1.6}code{display:block;margin-top:12px;background:#0d0d12;border:1px solid #374151;border-radius:10px;padding:10px;font-size:12px;color:#fca5a5;word-break:break-all}</style><div class="card"><h1>$title</h1><p>Cierra BKeeper en el teléfono y vuelve a activar el escritorio remoto.</p><code>${detail.replace("&", "&amp;").replace("<", "&lt;")}</code></div></html>"""

    private fun statusReason(status: Int): String = when (status) {
        200 -> "OK"; 303 -> "See Other"; 400 -> "Bad Request"
        404 -> "Not Found"; 410 -> "Gone"; 502 -> "Bad Gateway"
        503 -> "Service Unavailable"; else -> "OK"
    }

    private fun writeResponse(out: BufferedOutputStream, status: Int, headers: Map<String, String>, body: String) {
        val bytes = body.toByteArray(StandardCharsets.UTF_8)
        val head = buildString {
            append("HTTP/1.1 $status ${statusReason(status)}\r\n")
            headers.forEach { (key, value) -> append("$key: $value\r\n") }
            append("Content-Length: ${bytes.size}\r\nConnection: close\r\n\r\n")
        }
        out.write(head.toByteArray(StandardCharsets.US_ASCII)); out.write(bytes); out.flush()
    }

    private fun writeRawResponse(out: BufferedOutputStream, raw: String, origin: String) {
        val separator = if (raw.contains("\r\n\r\n")) "\r\n\r\n" else "\n\n"
        val index = raw.indexOf(separator)
        val head = if (index >= 0) raw.substring(0, index) else ""
        var body = if (index >= 0) raw.substring(index + separator.length) else raw
        val bodyBytes = body.toByteArray(StandardCharsets.UTF_8)

        // processRawPHPResponse() can hand back a bare body with no head at all.
        var lines = head.lines().filter { line ->
            val name = line.substringBefore(':', "")
            !name.equals("Content-Length", true) && !name.equals("Transfer-Encoding", true)
        }
        if (lines.none { it.startsWith("HTTP/") }) {
            lines = listOf("HTTP/1.1 200 OK") + lines
        }
        if (lines.none { it.substringBefore(':', "").equals("Content-Type", true) }) {
            lines = lines + listOf("Content-Type: text/html; charset=utf-8")
        }

        // Rewrite loopback origins and re-host cookies for the LAN client so the
        // computer's browser holds a valid Laravel session for the LAN host.
        body = body
            .replace("https://127.0.0.1", origin)
            .replace("http://127.0.0.1", origin)
        lines = lines.map { line ->
            when {
                line.startsWith("Location:", true) ->
                    "Location: " + line.substringAfter(':').trim()
                        .replace("https://127.0.0.1", origin)
                        .replace("http://127.0.0.1", origin)
                line.startsWith("Set-Cookie:", true) -> {
                    val cleaned = line.substringAfter(':').trim()
                        .replace("https://127.0.0.1", origin)
                        .replace("http://127.0.0.1", origin)
                        .replace(Regex(";\\s*Domain=[^;]*", RegexOption.IGNORE_CASE), "")
                        .replace(Regex(";\\s*Secure", RegexOption.IGNORE_CASE), "")
                    cleaned
                }
                else -> line
            }
        }

        out.write(
            (lines.joinToString("\r\n") + "\r\nContent-Length: ${bodyBytes.size}\r\nConnection: close\r\n\r\n")
                .toByteArray(StandardCharsets.US_ASCII)
        )
        out.write(bodyBytes)
        out.flush()
    }

    private fun wifiAddress(context: Context): String? {
        val manager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return null
        val network = manager.activeNetwork ?: return null
        val capabilities = manager.getNetworkCapabilities(network) ?: return null
        if (!capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) return null
        return manager.getLinkProperties(network)?.linkAddresses.orEmpty().asSequence()
            .filterIsInstance<LinkAddress>().map { it.address }
            .firstOrNull { !it.isLinkLocalAddress && it.address.size == 4 }?.hostAddress
    }
}

