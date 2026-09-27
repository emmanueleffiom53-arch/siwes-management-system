export function Icon({ children }) { return <span className="icon" aria-hidden="true">{children}</span> }

export function Status({ status }) { return <span className={`status ${status.toLowerCase()}`}><i />{status}</span> }

export function Stat({ value, label, tone }) { return <div className={`stat ${tone || ''}`}><strong>{value}</strong><span>{label}</span></div> }
