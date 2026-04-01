"use client";

import { useState } from "react";

type HiddenField = {
  name: string;
  value: string;
};

type ActionConfirmFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  buttonClassName: string;
  buttonLabel: string;
  modalTitle: string;
  modalDescription: string;
  confirmLabel?: string;
  cancelLabel?: string;
  hiddenFields: HiddenField[];
  disabled?: boolean;
};

export function ActionConfirmForm({
  action,
  buttonClassName,
  buttonLabel,
  modalTitle,
  modalDescription,
  confirmLabel = "تأكيد",
  cancelLabel = "إلغاء",
  hiddenFields,
  disabled = false,
}: ActionConfirmFormProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={buttonClassName}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {buttonLabel}
      </button>

      {open ? (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800">{modalTitle}</h3>
            <p className="mt-2 text-sm text-slate-600">{modalDescription}</p>
            <form action={action} className="mt-5 flex flex-wrap justify-end gap-2">
              {hiddenFields.map((field) => (
                <input key={field.name} type="hidden" name={field.name} value={field.value} />
              ))}
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
                {cancelLabel}
              </button>
              <button className="btn-primary">{confirmLabel}</button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
