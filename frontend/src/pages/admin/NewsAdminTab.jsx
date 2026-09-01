import React, { useMemo } from "react";
import { NewsManager } from "../../components/news";

export default function NewsAdminTab() {
  const targets = useMemo(() => [{ key: "platform:platform", scope: "platform", id: "platform", label: "Платформа · Синтезум" }], []);
  return <NewsManager endpoint="/admin/news" targets={targets} admin />;
}
