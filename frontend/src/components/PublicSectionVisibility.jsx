import React from "react";
import { Eye, EyeOff } from "lucide-react";
import { setPublicSectionVisibility } from "../utils/publicSections";

export default function PublicSectionVisibility({ sections, hiddenSections, onChange }) {
  const hidden = Array.isArray(hiddenSections) ? hiddenSections : [];

  return (
    <div className="public-section-visibility">
      <p className="public-section-visibility__hint">
        Выберите блоки для публичной страницы. Пустые блоки не отображаются независимо от настройки.
      </p>
      <div className="public-section-visibility__grid">
        {sections.map((section) => {
          const visible = !hidden.includes(section.key);
          return (
            <label
              key={section.key}
              className={`public-section-toggle${visible ? " public-section-toggle--active" : ""}`}
            >
              <input
                type="checkbox"
                checked={visible}
                onChange={(event) => onChange(
                  setPublicSectionVisibility(hidden, section.key, event.target.checked),
                )}
              />
              <span className="public-section-toggle__icon" aria-hidden>
                {visible ? <Eye size={17} /> : <EyeOff size={17} />}
              </span>
              <span className="public-section-toggle__copy">
                <strong>{section.label}</strong>
                <small>{section.description}</small>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
