const selectClass = "rounded border border-line-strong bg-background px-2 py-1";

/** A labelled select for a GET filter form: the first option, "All …", means no filter. */
export function FilterSelect({
  id,
  name,
  label,
  allLabel,
  value,
  options,
}: {
  id: string;
  name: string;
  label: string;
  allLabel: string;
  value: string | undefined;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select id={id} name={name} defaultValue={value ?? ""} className={selectClass}>
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** The non-empty string values of the given search params, e.g. the filters of a page. */
export function pickParams(
  params: Record<string, string | string[] | undefined>,
  names: string[],
): Record<string, string> {
  return Object.fromEntries(
    names.flatMap((name) => {
      const value = params[name];
      return typeof value === "string" && value !== "" ? [[name, value]] : [];
    }),
  );
}

/** "?a=1&b=2" from the values that are set. */
export function queryString(values: Record<string, string | undefined>): string {
  const params = new URLSearchParams(
    Object.entries(values).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
  return params.size > 0 ? `?${params}` : "";
}
