export default function Footer() {
  return (
    <footer className="bg-muted/50 p-4 text-center text-sm text-muted-foreground">
      <div className="flex flex-wrap justify-center gap-4">
        <Link to="/" className="hover:text-trust transition-colors">
          Home
        </Link>
        <Link to="/companion" className="hover:text-trust transition-colors">
          AI Companion
        </Link>
        <Link to="/ai-transparency" className="hover:text-trust transition-colors">
          AI Transparency & Safety
        </Link>
        <Link to="/support" className="hover:text-trust transition-colors">
          Help
        </Link>
        <Link to="/terms" className="hover:text-trust transition-colors">
          Terms of Service
        </Link>
        <Link to="/privacy" className="hover:text-trust transition-colors">
          Privacy Policy
        </Link>
      </div>
      <p className="mt-2 text-xs">
        © SolenOS {new Date().getFullYear()}
      </p>
    </footer>
  );
}
