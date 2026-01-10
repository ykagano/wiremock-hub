# Custom CA Certificates

Place your corporate CA certificates here if you're behind an SSL-inspecting proxy (Zscaler, Netskope, etc.).

## Usage

1. Export your corporate CA certificate in PEM format
2. Save it in this directory with `.crt` extension
3. Run `docker compose up -d --build`

## How to Export Certificates

### macOS

```bash
# Find and export corporate CA certificate
# Replace "YourCompany" with your certificate name
security find-certificate -a -c "YourCompany" -p \
  /Library/Keychains/System.keychain > custom-certs/corporate-ca.crt
```

Common certificate names:
- Zscaler: `security find-certificate -a -c "Zscaler" -p ...`
- Netskope: `security find-certificate -a -c "Netskope" -p ...`

### Windows

1. Open Certificate Manager (`certmgr.msc`)
2. Navigate to "Trusted Root Certification Authorities"
3. Find your corporate CA certificate
4. Right-click > All Tasks > Export
5. Choose "Base-64 encoded X.509 (.CER)"
6. Save as `corporate-ca.crt` in this directory

### Linux

```bash
# Certificates are usually in /etc/ssl/certs/ or /usr/local/share/ca-certificates/
cp /path/to/corporate-ca.crt custom-certs/
```

## Notes

- Files with `.crt` extension in this directory are automatically added to the Docker build
- Certificate files are excluded from Git (see .gitignore)
- Multiple certificates are supported - just add more `.crt` files
