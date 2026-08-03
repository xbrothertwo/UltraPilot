type PageHeadingProps = {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
};

export function PageHeading({ eyebrow, title, description, action }: PageHeadingProps) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div>
        {eyebrow ? <p className="eyebrow mb-2.5">{eyebrow}</p> : null}
        <h1 className="text-3xl font-black tracking-[-.035em] text-[var(--ink)] sm:text-[2.7rem] sm:leading-[1.05]">{title}</h1>
        <p className="mt-3 max-w-2xl leading-7 text-[var(--muted)]">{description}</p>
      </div>
      {action}
    </div>
  );
}
