export function Backdrop() {
  return (
    <>
      <div className="sun" aria-hidden="true">
        <div className="sun-bars" />
      </div>
      <div className="horizon" aria-hidden="true">
        <div className="floor" />
      </div>
      <div className="scanlines" aria-hidden="true" />
    </>
  );
}
