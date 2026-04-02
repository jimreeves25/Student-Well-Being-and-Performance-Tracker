import React from "react";

function StatsCard({ label, value, helper, tone = "default" }) {
  return (
    <article className={`stats-card stats-card-${tone}`}>
      <small>{label}</small>
      <strong>{value}</strong>
      <span>{helper}</span>
    </article>
  );
}

export default StatsCard;
