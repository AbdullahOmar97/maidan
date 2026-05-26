import os
import sys
import subprocess

def main():
    env_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
    
    if os.path.exists(env_file):
        with open(env_file, 'r') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                if '=' in line:
                    key, val = line.split('=', 1)
                    # Strip quotes if present
                    val = val.strip().strip("'").strip('"')
                    # If POSTGRES_HOST is 'db', change to 'localhost' so we can connect from WSL host
                    if key.strip() == 'POSTGRES_HOST' and val == 'db':
                        val = 'localhost'
                    os.environ[key.strip()] = val

    # Enforce standard defaults if not in .env
    os.environ.setdefault('DJANGO_SECRET_KEY', 'change-me-to-a-long-random-string-at-least-50-chars')
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')

    cmd = sys.argv[1:]
    if not cmd:
        print("Usage: python run_with_env.py <command>")
        sys.exit(1)

    result = subprocess.run(cmd, env=os.environ)
    sys.exit(result.returncode)

if __name__ == '__main__':
    main()
