export function AuthDivider() {
  return (
    <div className="relative my-6 text-center text-xs text-muted-foreground uppercase">
      <span className="absolute inset-x-0 top-1/2 h-px bg-border" aria-hidden />
      <span className="relative bg-background px-2">or</span>
    </div>
  );
}
