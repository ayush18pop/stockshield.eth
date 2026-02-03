import { cn } from "@/lib/utils";

export const BentoGrid = ({
    className,
    children,
}: {
    className?: string;
    children: React.ReactNode;
}) => {
    return (
        <div
            className={cn(
                "grid md:auto-rows-[18rem] grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-7xl mx-auto ",
                className
            )}
        >
            {children}
        </div>
    );
};

export const BentoGridItem = ({
    className,
    title,
    description,
    header,
    icon,
}: {
    className?: string;
    title?: string | React.ReactNode;
    description?: string | React.ReactNode;
    header?: React.ReactNode;
    icon?: React.ReactNode;
}) => {
    return (
        <div
            className={cn(
                "row-span-1 rounded-xl group/bento hover:shadow-[0_0_40px_rgba(255,77,0,0.08)] transition-all duration-300 p-4 bg-[#0a0a0a] border border-white/5 hover:border-white/10 justify-between flex flex-col space-y-4",
                className
            )}
        >
            {header}
            <div className="group-hover/bento:translate-x-2 transition duration-300">
                {icon}
                <div className="font-sans font-medium text-white mb-2 mt-2 tracking-tight">
                    {title}
                </div>
                <div className="font-sans font-normal text-neutral-400 text-sm leading-relaxed">
                    {description}
                </div>
            </div>
        </div>
    );
};
