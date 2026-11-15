import { useEffect, useId, useRef, useState } from "react";
import { maskValue, validateValue } from "./validation.js";
export default function ValidatedInput({ kind, value, onChange, ...rest }) {
  const id = useId(),
    input = useRef(null),
    [touched, setTouched] = useState(false),
    error = validateValue(kind, value);
  useEffect(() => {
    input.current?.setCustomValidity(error);
  }, [error]);
  return (
    <span className="validated-input">
      <input
        {...rest}
        ref={input}
        value={value}
        type={rest.type || (kind === "email" ? "email" : "text")}
        inputMode={
          kind === "phone"
            ? "tel"
            : kind === "document"
              ? "numeric"
              : rest.inputMode
        }
        onChange={(event) => {
          event.target.value = maskValue(kind, event.target.value);
          onChange?.(event);
        }}
        onBlur={() => setTouched(true)}
        aria-invalid={touched && !!error}
        aria-describedby={touched && error ? id : rest["aria-describedby"]}
      />
      {touched && error && (
        <small id={id} role="alert">
          {error}
        </small>
      )}
    </span>
  );
}
