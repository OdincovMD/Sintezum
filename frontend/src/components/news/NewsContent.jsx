import React from "react";

function renderText(node, key) {
  let value = node.text || "";
  const marks = Array.isArray(node.marks) ? node.marks : [];
  return marks.reduce((child, mark, index) => {
    if (mark.type === "bold") return <strong key={`${key}-b-${index}`}>{child}</strong>;
    if (mark.type === "italic") return <em key={`${key}-i-${index}`}>{child}</em>;
    if (mark.type === "link") {
      return (
        <a
          key={`${key}-l-${index}`}
          href={mark.attrs?.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          {child}
        </a>
      );
    }
    return child;
  }, value);
}

function renderNode(node, key) {
  if (!node || typeof node !== "object") return null;
  if (node.type === "text") return renderText(node, key);
  if (node.type === "hardBreak") return <br key={key} />;
  if (node.type === "image") {
    return (
      <figure className="news-content__image" key={key}>
        <img src={node.attrs?.src} alt={node.attrs?.alt || "Иллюстрация новости"} loading="eager" decoding="async" />
      </figure>
    );
  }
  const children = (node.content || []).map((child, index) => renderNode(child, `${key}-${index}`));
  if (node.type === "heading") {
    return node.attrs?.level === 3
      ? <h3 key={key}>{children}</h3>
      : <h2 key={key}>{children}</h2>;
  }
  if (node.type === "paragraph") return <p key={key}>{children}</p>;
  if (node.type === "doc") return <React.Fragment key={key}>{children}</React.Fragment>;
  return null;
}

export default function NewsContent({ content, className = "" }) {
  return (
    <div className={`news-content ${className}`.trim()}>
      {renderNode(content, "news-root")}
    </div>
  );
}
