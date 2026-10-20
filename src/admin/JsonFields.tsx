import type { ReactNode } from "react";
function labelFor(key: string) {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");
}
function clone(value: unknown) {
  return structuredClone(value);
}
interface Props {
  value: unknown;
  template?: unknown;
  path: string;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}
export function JsonFields({
  value,
  template = value,
  path,
  onChange,
  disabled,
}: Props): ReactNode {
  if (Array.isArray(value)) {
    const fixed = [
      "home.cards",
      "home.directories",
      "home.mission",
      "contact.links",
      "navigation",
    ].includes(path);
    const fixedOrder = path === "contact.links";
    const sample = Array.isArray(template) ? template[0] : "";
    return (
      <fieldset className="cms-group" disabled={disabled}>
        <legend>{labelFor(path.split(".").at(-1)!)}</legend>
        {value.map((item, index) => (
          <div className="cms-array-item" key={`${path}-${index}`}>
            <JsonFields
              value={item}
              template={sample}
              path={`${path}.${index}`}
              onChange={(next) =>
                onChange(value.map((old, i) => (i === index ? next : old)))
              }
            />
            <div className="cms-actions">
              {!fixedOrder && (
                <>
                  <button
                    type="button"
                    disabled={index === 0}
                    aria-label={`Move ${path} item ${index + 1} up`}
                    onClick={() => {
                      const next = [...value];
                      [next[index - 1], next[index]] = [
                        next[index],
                        next[index - 1],
                      ];
                      onChange(next);
                    }}
                  >
                    ↑ Up
                  </button>
                  <button
                    type="button"
                    disabled={index === value.length - 1}
                    aria-label={`Move ${path} item ${index + 1} down`}
                    onClick={() => {
                      const next = [...value];
                      [next[index + 1], next[index]] = [
                        next[index],
                        next[index + 1],
                      ];
                      onChange(next);
                    }}
                  >
                    ↓ Down
                  </button>
                </>
              )}
              {!fixed && (
                <button
                  type="button"
                  onClick={() => onChange(value.filter((_, i) => i !== index))}
                >
                  Remove item {index + 1}
                </button>
              )}
            </div>
          </div>
        ))}
        {!fixed && (
          <button
            type="button"
            onClick={() => {
              const next = clone(sample ?? "");
              if (
                next &&
                typeof next === "object" &&
                !Array.isArray(next) &&
                "id" in next
              )
                (next as { id: string }).id = crypto.randomUUID();
              onChange([...value, next]);
            }}
          >
            Add item
          </button>
        )}
      </fieldset>
    );
  }
  if (value && typeof value === "object") {
    return (
      <div className="cms-fields">
        {Object.entries(value).map(([key, item]) => (
          <JsonFields
            key={key}
            value={item}
            template={
              template && typeof template === "object"
                ? (template as Record<string, unknown>)[key]
                : item
            }
            path={`${path}.${key}`}
            disabled={disabled}
            onChange={(next) => onChange({ ...value, [key]: next })}
          />
        ))}
      </div>
    );
  }
  const id = `field-${path}`;
  const multiline =
    /description|mission|message|excerpt|content|copyright/.test(path) ||
    String(value ?? "").length > 120;
  return (
    <label className="cms-field" htmlFor={id}>
      <span>{labelFor(path.split(".").at(-1)!)}</span>
      {multiline ? (
        <textarea
          id={id}
          rows={3}
          maxLength={10000}
          value={String(value ?? "")}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={id}
          value={String(value ?? "")}
          maxLength={10000}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
