import React, { useRef, useEffect } from "react";
import { normalizeWebsiteInput } from "../../../utils/validation";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { 
  BuildingIcon, 
  MapPinIcon, 
  GlobeIcon 
} from "../../../components/auth";
import OrgOpenAlexSection from "../OrgOpenAlexSection";
import PublicSectionVisibility from "../../../components/PublicSectionVisibility";
import { ORGANIZATION_PUBLIC_SECTIONS } from "../../../utils/publicSections";

/**
 * Модуль «Профиль организации»: название, аватар, адрес, сайт, описание, сохранение и публикация.
 */
export default function ProfileTab({
  orgProfile,
  handleOrgChange,
  uploadOrgAvatar,
  uploading,
  saving,
  saveOrganization,
  toggleOrgPublish,
  onAvatarInputRefReady,
  onOrgRorLinked,
}) {
  const avatarInputRef = useRef(null);

  useEffect(() => {
    onAvatarInputRefReady?.(avatarInputRef);
  }, [onAvatarInputRefReady]);

  return (
    <div className="profile-form profile-form--grouped org-profile-tab">
      <div className="profile-form-group">
        <div className="profile-form-group-title">
          Основные данные
          {orgProfile && orgProfile.name && (
            <span
              className={`ui-badge ${orgProfile.is_published ? "ui-badge--published" : "ui-badge--draft"}`}
            >
              {orgProfile.is_published ? "Опубликована" : "Черновик"}
            </span>
          )}
        </div>
        <div className="profile-form__fields">
          <Input
            id="org-name"
            label="Название организации"
            value={orgProfile?.name || ""}
            onChange={(e) => handleOrgChange("name", e.target.value)}
            placeholder="Название"
            icon={<BuildingIcon />}
          />
          
          <div className="ui-input-group mt-4">
            <label htmlFor="org-description">Описание</label>
            <textarea
              id="org-description"
              rows={4}
              className="ui-input"
              value={orgProfile?.description || ""}
              onChange={(e) => handleOrgChange("description", e.target.value)}
              placeholder="Краткое описание организации"
            />
          </div>

          <div className="ui-input-group mt-4">
            <label htmlFor="org-avatar">Аватар организации</label>
            <div className="avatar-upload-row">
              <input
                ref={avatarInputRef}
                id="org-avatar"
                type="file"
                className="ui-input"
                accept="image/*"
                onChange={(e) => uploadOrgAvatar(e.target.files?.[0])}
                disabled={uploading || saving}
              />
              {orgProfile?.avatar_url && (
                <div className="avatar-preview-mini">
                  <img src={orgProfile.avatar_url} alt="Аватар организации" />
                  <button className="file-remove" onClick={() => handleOrgChange("avatar_url", "")} title="Удалить">
                    ×
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="profile-form-group">
        <div className="profile-form-group-title">Локация и контакты</div>
        <div className="profile-form__row">
          <Input
            id="org-address"
            label="Адрес"
            value={orgProfile?.address || ""}
            onChange={(e) => handleOrgChange("address", e.target.value)}
            placeholder="Город, улица, дом"
            icon={<MapPinIcon />}
          />
          <Input
            id="org-website"
            label="Сайт"
            type="url"
            value={orgProfile?.website || ""}
            onChange={(e) => handleOrgChange("website", e.target.value)}
            onBlur={(e) => {
              const v = (e.target.value || "").trim();
              if (v) handleOrgChange("website", normalizeWebsiteInput(v));
            }}
            placeholder="example.com"
            icon={<GlobeIcon />}
          />
        </div>
      </div>

      <div className="profile-form-group">
        <div className="profile-form-group-title">Разделы публичной страницы</div>
        <PublicSectionVisibility
          sections={ORGANIZATION_PUBLIC_SECTIONS}
          hiddenSections={orgProfile?.hidden_public_sections}
          onChange={(value) => handleOrgChange("hidden_public_sections", value)}
        />
      </div>

      <div className="profile-form-group">
        <div className="profile-form-group-title">Интеграции</div>
        <OrgOpenAlexSection orgProfile={orgProfile} onOrgRorLinked={onOrgRorLinked} compact hideLabel />
      </div>

      <div className="profile-actions-wrap">
        <Button variant="primary" onClick={saveOrganization} loading={saving} disabled={saving}>
          {saving ? "Сохраняем..." : "Сохранить изменения"}
        </Button>
        {orgProfile && orgProfile.name && (
          <Button
            variant={orgProfile.is_published ? "secondary" : "ghost"}
            onClick={() => toggleOrgPublish(!orgProfile.is_published)}
            disabled={saving}
          >
            {orgProfile.is_published ? "Снять с публикации" : "Опубликовать"}
          </Button>
        )}
      </div>
    </div>
  );
}
