import React from 'react';
import { NumericFormat } from 'react-number-format';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export default function FormattedNumberInput({
    className = '',
    value,
    onChange,
    isAllowed,
    ...props
}) {
    return (
        <NumericFormat
            {...props}
            value={value}
            onValueChange={(values) => {
                if (onChange) {
                    onChange({
                        target: {
                            name: props.name,
                            value: values.value, // This is the unformatted value, e.g., '1234.56'
                        },
                    });
                }
            }}
            isAllowed={isAllowed}
            thousandSeparator="."
            decimalSeparator=","
            allowNegative={true}
            className={cn(
                'border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 focus:border-indigo-500 dark:focus:border-indigo-600 focus:ring-indigo-500 dark:focus:ring-indigo-600 rounded-md shadow-sm',
                className
            )}
        />
    );
}
