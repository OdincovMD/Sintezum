import React from "react";
import {
  ProfileTab,
  LaboratoriesTab,
  EquipmentTab,
  StaffTab,
  TasksTab,
  QueriesTab,
  VacanciesTab,
} from "./org";
import JoinRequestsIncomingTab from "./JoinRequestsIncomingTab";
import VacancyResponsesIncomingTab from "./VacancyResponsesIncomingTab";
import MyJoinRequestsSection from "./MyJoinRequestsSection";
import EmployerDashboard from "./EmployerDashboard";
import NewsTab from "./org/NewsTab";

export default function OrganizationProfileSection({
  title = "Профиль организации",
  orgTab,
  setOrgTab,
  orgProfile,
  handleOrgChange,
  uploadOrgAvatar,
  uploading,
  saving,
  saveOrganization,
  toggleOrgPublish,
  onOrgAvatarInputRefReady,
  onOrgStaffFileInputRefsReady,
  onOrgEquipmentFileInputRefsReady,
  onOrgLabFileInputRefsReady,
  labDraft,
  handleLabDraft,
  orgEmployees,
  toggleLabEmployee,
  setLabHead,
  toggleLabEquipment,
  toggleLabTaskSolution,
  handleLabFiles,
  removeDraftImage,
  splitMedia,
  fileNameFromUrl,
  createLab,
  orgLabs,
  editingLabId,
  labEdit,
  handleLabEditChange,
  handleLabEditFiles,
  removeEditImage,
  updateLab,
  cancelEditLab,
  startEditLab,
  deleteLab,
  equipmentDraft,
  handleEquipmentDraft,
  handleEquipmentFiles,
  createEquipment,
  orgEquipment,
  editingEquipmentId,
  equipmentEdit,
  handleEquipmentEditChange,
  handleEquipmentEditFiles,
  updateEquipment,
  cancelEditEquipment,
  startEditEquipment,
  deleteEquipment,
  openGallery,
  taskDraft,
  setTaskDraft,
  createTask,
  toggleTaskLab,
  orgTasks,
  editingTaskId,
  taskEdit,
  handleTaskEditChange,
  updateTask,
  cancelEditTask,
  startEditTask,
  deleteTask,
  orgQueries,
  queryDraft,
  setQueryDraft,
  createQuery,
  editingQueryId,
  queryEdit,
  setQueryEdit,
  updateQuery,
  cancelEditQuery,
  startEditQuery,
  deleteQuery,
  toggleQueryLab,
  toggleQueryEmployee,
  orgVacancies,
  vacancyDraft,
  setVacancyDraft,
  createVacancy,
  editingVacancyId,
  vacancyEdit,
  setVacancyEdit,
  updateVacancy,
  cancelEditVacancy,
  startEditVacancy,
  deleteVacancy,
  employeeDraft,
  handleEmployeeDraftChange,
  uploadEmployeePhoto,
  employeeDraftPositionInput,
  setEmployeeDraftPositionInput,
  toggleEmployeeLab,
  addEducation,
  removeEducation,
  showDraftPublications,
  setShowDraftPublications,
  updatePublication,
  removePublication,
  addPublication,
  employeeDraftContacts,
  handleEmployeeContacts,
  createEmployee,
  employeeEditId,
  employeeEdit,
  handleEmployeeEditChange,
  employeeEditPositionInput,
  setEmployeeEditPositionInput,
  showEditPublications,
  setShowEditPublications,
  employeeEditPublicationList,
  updateEmployee,
  cancelEditEmployee,
  startEditEmployee,
  deleteEmployee,
  setEmployeeDraft,
  setEmployeeEdit,
  setEmployeePreview,
  setShowEmployeePublications,
  importEmployeeOpenAlex,
  importEmployeeOpenAlexPreview,
  employeeDraftImporting,
  toggleLabPublish,
  toggleQueryPublish,
  toggleVacancyPublish,
  toggleEquipmentLab,
  onNavigateToSubscription,
  showProfileTab = true,
  hideTitle = false,
  onOrgRorLinked,
  roleKey,
  onError,
}) {
  return (
    <div className="profile-section profile-section--no-border">
      {!hideTitle && <h3 className="profile-section-title">{title}</h3>}
      {orgTab === "dashboard" && (
        <EmployerDashboard onError={onError} onNavigateToSubscription={onNavigateToSubscription} />
      )}

      {orgTab === "my-requests" && roleKey === "lab_representative" && (
        <MyJoinRequestsSection roleKey="lab_representative" onError={onError} creatorLabs={orgLabs} />
      )}

      {showProfileTab && orgTab === "profile" && (
        <div className="profile-form-section">
          <p className="profile-tab-desc">Название, описание и контакты организации. Опубликуйте профиль, чтобы он был виден на платформе.</p>
          <ProfileTab
          orgProfile={orgProfile}
          handleOrgChange={handleOrgChange}
          uploadOrgAvatar={uploadOrgAvatar}
          uploading={uploading}
          saving={saving}
          saveOrganization={saveOrganization}
          toggleOrgPublish={toggleOrgPublish}
          onAvatarInputRefReady={onOrgAvatarInputRefReady}
          onOrgRorLinked={onOrgRorLinked}
        />
        </div>
      )}

      {orgTab === "labs" && (
        <LaboratoriesTab
          labDraft={labDraft}
          handleLabDraft={handleLabDraft}
          orgEquipment={orgEquipment}
          toggleLabEquipment={toggleLabEquipment}
          orgTasks={orgTasks}
          toggleLabTaskSolution={toggleLabTaskSolution}
          orgEmployees={orgEmployees}
          toggleLabEmployee={toggleLabEmployee}
          setLabHead={setLabHead}
          handleLabFiles={handleLabFiles}
          removeDraftImage={removeDraftImage}
          splitMedia={splitMedia}
          fileNameFromUrl={fileNameFromUrl}
          createLab={createLab}
          orgLabs={orgLabs}
          editingLabId={editingLabId}
          labEdit={labEdit}
          handleLabEditChange={handleLabEditChange}
          handleLabEditFiles={handleLabEditFiles}
          removeEditImage={removeEditImage}
          updateLab={updateLab}
          cancelEditLab={cancelEditLab}
          startEditLab={startEditLab}
          deleteLab={deleteLab}
          openGallery={openGallery}
          toggleLabPublish={toggleLabPublish}
          uploading={uploading}
          saving={saving}
          onFileInputRefsReady={onOrgLabFileInputRefsReady}
        />
      )}

      {orgTab === "equipment" && (
        <EquipmentTab
          equipmentDraft={equipmentDraft}
          handleEquipmentDraft={handleEquipmentDraft}
          orgLabs={orgLabs}
          toggleEquipmentLab={toggleEquipmentLab}
          handleEquipmentFiles={handleEquipmentFiles}
          removeDraftImage={removeDraftImage}
          splitMedia={splitMedia}
          fileNameFromUrl={fileNameFromUrl}
          createEquipment={createEquipment}
          orgEquipment={orgEquipment}
          editingEquipmentId={editingEquipmentId}
          equipmentEdit={equipmentEdit}
          handleEquipmentEditChange={handleEquipmentEditChange}
          handleEquipmentEditFiles={handleEquipmentEditFiles}
          removeEditImage={removeEditImage}
          updateEquipment={updateEquipment}
          cancelEditEquipment={cancelEditEquipment}
          startEditEquipment={startEditEquipment}
          deleteEquipment={deleteEquipment}
          openGallery={openGallery}
          uploading={uploading}
          saving={saving}
          onFileInputRefsReady={onOrgEquipmentFileInputRefsReady}
        />
      )}

      {orgTab === "news" && (
        <NewsTab roleKey={roleKey} organization={orgProfile} laboratories={orgLabs} />
      )}

      {orgTab === "staff" && (
        <StaffTab
          employeeDraft={employeeDraft}
          handleEmployeeDraftChange={handleEmployeeDraftChange}
          setEmployeeDraft={setEmployeeDraft}
          uploadEmployeePhoto={uploadEmployeePhoto}
          employeeDraftPositionInput={employeeDraftPositionInput}
          setEmployeeDraftPositionInput={setEmployeeDraftPositionInput}
          orgLabs={orgLabs}
          toggleEmployeeLab={toggleEmployeeLab}
          addEducation={addEducation}
          removeEducation={removeEducation}
          showDraftPublications={showDraftPublications}
          setShowDraftPublications={setShowDraftPublications}
          updatePublication={updatePublication}
          removePublication={removePublication}
          addPublication={addPublication}
          handleEmployeeContacts={handleEmployeeContacts}
          createEmployee={createEmployee}
          employeeEditId={employeeEditId}
          employeeEdit={employeeEdit}
          handleEmployeeEditChange={handleEmployeeEditChange}
          employeeEditPositionInput={employeeEditPositionInput}
          setEmployeeEditPositionInput={setEmployeeEditPositionInput}
          showEditPublications={showEditPublications}
          setShowEditPublications={setShowEditPublications}
          updateEmployee={updateEmployee}
          cancelEditEmployee={cancelEditEmployee}
          startEditEmployee={startEditEmployee}
          deleteEmployee={deleteEmployee}
          orgEmployees={orgEmployees}
          setEmployeePreview={setEmployeePreview}
          setShowEmployeePublications={setShowEmployeePublications}
          importEmployeeOpenAlex={importEmployeeOpenAlex}
          importEmployeeOpenAlexPreview={importEmployeeOpenAlexPreview}
          employeeDraftImporting={employeeDraftImporting}
          uploading={uploading}
          saving={saving}
          onFileInputRefsReady={onOrgStaffFileInputRefsReady}
        />
      )}

      {orgTab === "tasks" && (
        <TasksTab
          taskDraft={taskDraft}
          setTaskDraft={setTaskDraft}
          orgLabs={orgLabs}
          toggleTaskLab={toggleTaskLab}
          createTask={createTask}
          orgTasks={orgTasks}
          editingTaskId={editingTaskId}
          taskEdit={taskEdit}
          handleTaskEditChange={handleTaskEditChange}
          updateTask={updateTask}
          cancelEditTask={cancelEditTask}
          startEditTask={startEditTask}
          deleteTask={deleteTask}
          saving={saving}
        />
      )}

      {orgTab === "queries" && (
        <QueriesTab
          queryDraft={queryDraft}
          setQueryDraft={setQueryDraft}
          orgLabs={orgLabs}
          orgEmployees={orgEmployees}
          orgTasks={orgTasks}
          toggleQueryLab={toggleQueryLab}
          toggleQueryEmployee={toggleQueryEmployee}
          createQuery={createQuery}
          orgQueries={orgQueries}
          editingQueryId={editingQueryId}
          queryEdit={queryEdit}
          setQueryEdit={setQueryEdit}
          updateQuery={updateQuery}
          cancelEditQuery={cancelEditQuery}
          startEditQuery={startEditQuery}
          deleteQuery={deleteQuery}
          toggleQueryPublish={toggleQueryPublish}
          saving={saving}
        />
      )}

      {orgTab === "vacancies" && (
        <VacanciesTab
          vacancyDraft={vacancyDraft}
          setVacancyDraft={setVacancyDraft}
          orgLabs={orgLabs}
          orgEmployees={orgEmployees}
          orgQueries={orgQueries}
          createVacancy={createVacancy}
          orgVacancies={orgVacancies}
          editingVacancyId={editingVacancyId}
          vacancyEdit={vacancyEdit}
          setVacancyEdit={setVacancyEdit}
          updateVacancy={updateVacancy}
          cancelEditVacancy={cancelEditVacancy}
          startEditVacancy={startEditVacancy}
          deleteVacancy={deleteVacancy}
          toggleVacancyPublish={toggleVacancyPublish}
          saving={saving}
          onError={onError}
        />
      )}

      {orgTab === "join-requests" && (
        <JoinRequestsIncomingTab roleKey={roleKey} onError={onError} />
      )}
      {orgTab === "vacancy-responses" && (
        <VacancyResponsesIncomingTab onError={onError} />
      )}
    </div>
  );
}
