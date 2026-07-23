export default function ConnectionStatus({ connected }) {
  return (
    <div className={`connection-status ${connected ? 'connection-online' : 'connection-offline'}`}>
      <span className="connection-dot" />
      {connected ? 'Trực tuyến' : 'Đang kết nối lại...'}
    </div>
  );
}