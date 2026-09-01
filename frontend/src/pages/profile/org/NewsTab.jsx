import React, { useMemo } from "react";
import { NewsManager } from "../../../components/news";
import { Card } from "../../../components/ui";

export default function NewsTab({ roleKey, organization, laboratories = [] }) {
  const targets = useMemo(() => {
    const result = [];
    if (roleKey === "lab_admin" && organization?.id) {
      result.push({ key: `organization:${organization.id}`, scope: "organization", id: organization.id, label: `Организация · ${organization.name || "Без названия"}` });
    }
    laboratories.forEach((lab) => {
      if (lab?.id) result.push({ key: `laboratory:${lab.id}`, scope: "laboratory", id: lab.id, label: `Лаборатория · ${lab.name}` });
    });
    return result;
  }, [laboratories, organization?.id, organization?.name, roleKey]);

  return (
    <Card variant="solid" padding="lg" className="profile-section-card">
      <NewsManager endpoint="/profile/news" targets={targets} />
    </Card>
  );
}
