import React from "react";
import { Users } from "lucide-react";
import { EntityAvatar } from "../ui";

export default function NewsPeople({ employees = [], compact = false }) {
  if (employees.length === 0) return null;

  if (compact) {
    const names = employees.slice(0, 2).map((employee) => employee.full_name).join(", ");
    const rest = employees.length - 2;
    return (
      <div className="news-people news-people--compact" aria-label={`Участники новости: ${employees.map((employee) => employee.full_name).join(", ")}`}>
        <span className="news-people__avatars" aria-hidden>
          {employees.slice(0, 3).map((employee) => (
            <EntityAvatar key={employee.id} src={employee.photo_url} alt="" className="news-people__avatar" />
          ))}
        </span>
        <span>{names}{rest > 0 ? ` и ещё ${rest}` : ""}</span>
      </div>
    );
  }

  return (
    <section className="news-detail__people" aria-labelledby="news-people-title">
      <div className="news-detail__people-heading">
        <span><Users size={17} aria-hidden /></span>
        <div>
          <h2 id="news-people-title">Участники новости</h2>
          <p>Сотрудники организации или лаборатории, связанные с публикацией</p>
        </div>
      </div>
      <div className="news-detail__people-list">
        {employees.map((employee) => {
          const meta = [employee.academic_degree, ...(employee.positions || [])].filter(Boolean).join(" · ");
          return (
            <article className="news-detail__person" key={employee.id}>
              <EntityAvatar src={employee.photo_url} alt={employee.full_name} className="news-detail__person-avatar" />
              <div><strong>{employee.full_name}</strong>{meta && <span>{meta}</span>}</div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
