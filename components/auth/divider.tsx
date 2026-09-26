export function AuthDivider() {
  return (
    <div className="text-muted-foreground relative my-6 text-center text-xs uppercase">
      <span className="bg-border absolute inset-x-0 top-1/2 h-px" aria-hidden />
      <span className="bg-background relative px-2">or</span>
    </div>
  );
}
