package com.bkeeper.remotedesktop

import android.content.Context
import com.nativephp.mobile.bridge.BridgeFunction

object RemoteDesktopFunctions {
    class Start(private val context: Context) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            val port = (parameters["port"] as? Number)?.toInt() ?: 8080
            val token = parameters["token"] as? String
                ?: return mapOf("status" to "error", "message" to "Falta el código de acceso.")
            val ttl = (parameters["ttl_seconds"] as? Number)?.toLong() ?: 900L
            return RemoteDesktopServer.start(context, port, token, ttl)
        }
    }

    class Stop(private val context: Context) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> =
            RemoteDesktopServer.stop()
    }

    class Status(private val context: Context) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> =
            RemoteDesktopServer.status(context)
    }
}
