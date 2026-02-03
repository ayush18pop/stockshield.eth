import { cn } from "@/lib/utils";

interface DotMatrixProps {
    text: string;
    className?: string;
    size?: "sm" | "md" | "lg";
}

export function DotMatrix({ text, className, size = "md" }: DotMatrixProps) {
    const sizeClasses = {
        sm: "text-xs tracking-[0.2em]",
        md: "text-base tracking-[0.3em]",
        lg: "text-4xl tracking-[0.4em]",
    };

    return (
        <div className={cn("font-mono font-bold uppercase text-white/80", sizeClasses[size], className)} aria-label={text}>
            {text.split("").map((char, i) => (
                <span key={i} className="inline-block hover:text-[#FF4D00] transition-colors duration-300 cursor-default">
                    {char}
                </span>
            ))}
        </div>
    );
}
