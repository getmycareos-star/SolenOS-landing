const approved = process.env.SOLENOS_RELEASE_APPROVED === "true";
const productionContext = process.env.CONTEXT === "production";

if (productionContext && !approved) {
  process.stdout.write(
    "Skipping automatic production build: SolenOS release acceptance has not been explicitly approved.\n",
  );
  process.exit(0);
}

// Netlify ignore-command exit code 1 means continue with the build.
process.exit(1);
