// Fixed, full-viewport animated gradient mesh rendered once behind all routes.
// Pure CSS (transform/opacity only) so it stays cheap on the compositor and
// doesn't fight scrolling or fixed page content.
export function LiveWallpaper() {
  return (
    <div className="nova-wallpaper" aria-hidden="true">
      <div className="nova-wallpaper-blob nova-wallpaper-blob-1" />
      <div className="nova-wallpaper-blob nova-wallpaper-blob-2" />
      <div className="nova-wallpaper-blob nova-wallpaper-blob-3" />
      <div className="nova-wallpaper-blob nova-wallpaper-blob-4" />
      <div className="nova-wallpaper-grain" />
    </div>
  );
}
