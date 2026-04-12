import React from 'react';

const Button = ({ children, variant = 'primary', className = '', ...props }) => {
    const baseStyles = "font-bold py-2 px-6 rounded-lg transition-all duration-300 transform hover:-translate-y-0.5 shadow-md flex items-center justify-center gap-2";

    const variants = {
        primary: "bg-primary text-white hover:bg-[#34495e] border-2 border-transparent",
        secondary: "bg-secondary text-white hover:bg-[#6b8c93] border-2 border-transparent",
        outline: "bg-transparent text-primary border-2 border-primary hover:bg-primary hover:text-white",
        danger: "bg-red-500 text-white hover:bg-red-600 border-2 border-transparent",
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};

export default Button;
