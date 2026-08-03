type PageHeadingProps = {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
};

export function PageHeading({ eyebrow, title, description, action }: PageHeadingProps) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 sm:mb-8 sm:flex-row sm:items-end sm:gap-5">
      <div className="relative pl-4 sm:pl-5">
        <span aria-hidden className="absolute inset-y-1 left-0 w-1 rounded-full bg-gradient-to-b from-blue-500 to-cyan-400" />
        {eyebrow ? <p className="eyebrow mb-2.5">{eyebrow}</p> : null}
        <h1 className="text-[2rem] font-black leading-[1.03] tracking-[-.045em] text-[var(--ink)] sm:text-[2.75rem]">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:mt-3 sm:text-base sm:leading-7">{description}</p>
      </div>
      {action ? <div className="w-full sm:w-auto [&>*]:w-full sm:[&>*]:w-auto">{action}</div> : null}
    </div>
  );
}
