"""Compatibility entry point for the maintained roster importer."""
import runpy
from pathlib import Path
runpy.run_path(str(Path(__file__).parent / "scripts" / "import-roster.py"), run_name="__main__")
