import React from "react";

function DashboardGrid({ sidebar, topbar, main, rightPanel }) {
  return (
    <div className="dashboard-layout-shell">
      <aside className="dashboard-layout-sidebar">{sidebar}</aside>
      <div className="dashboard-layout-main-column">
        <header className="dashboard-layout-topbar">{topbar}</header>
        <main className="dashboard-layout-main">{main}</main>
      </div>
      <aside className="dashboard-layout-rightpanel">{rightPanel}</aside>
    </div>
  );
}

export default DashboardGrid;
