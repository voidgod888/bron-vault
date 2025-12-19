# Broń Vault

Broń Vault is an open-source stealer logs dashboard designed to simplify the process of analyzing stealer log data. 

> 💡 If you're new to this concept, we recommend reading our introductory article on our blog: ['Stealer Logs: Perspectives on Attack and Defense in a Silent Epidemic, and How Broń Vault Automates the Parsing Process'](https://blog.intellibron.io/stealer-logs-perspectives-on-attack-and-defense-in-a-silent-epidemic-and-how-bron-vault-automates-the-parsing-process/).

Forget complex ad-hoc scripts. With Broń Vault, you can simply drag and drop `.zip` log files into the web interface. The application automatically parses the data and presents it in a structured format, ready for inspection.

Our goal is to support the day-to-day needs of security teams on the front lines by providing a practical alternative to manual scripting or overly complex platforms typically required for stealer log analysis. This project reflects our mission to democratize security, making foundational analysis capabilities accessible to everyone and allowing analysts to focus on critical decision-making instead of manual log parsing.

> ⚠️ **Note:** This tool was developed as a side project and is not intended for production use. Please see the [Important Notice](#important-notice) section below.

![alt text](images/Bron-Vault-Dashboard.png "Bron Vault Dashboard")

-----

## Key Features

  * **File Upload & Processing**:
    - Upload `.zip` files containing common stealer log formats.
    - Real-time upload progress tracking and detailed logging.
    - Automatic extraction and parsing of credentials, cookies, and system information.

  * **Telegram Scraper**:
    - Automatically scrape and ingest stealer logs from monitored Telegram channels.
    - Configure specific channels to monitor via the UI.
    - Downloads and parses `.zip` and `.txt` files automatically.
    - [See Setup Guide](docs/TELEGRAM_SCRAPER.md)

  * **Background Asset Scanner**:
    - Active reconnaissance on discovered domains using a dedicated background worker.
    - Scans for open ports (HTTP, SSH, FTP, MySQL, etc.) on discovered hosts.
    - Captures web metadata (titles, server headers) and SSL certificate details.
    - Powered by Redis for reliable job queuing.

  * **Advanced Visualizations**:
    - **Geospatial Analysis**: Interactive world map visualizing the physical location of infected devices.
    - **Link Analysis**: Force-directed graph visualizations to explore relationships between devices, domains, and files.
    - **Analytics Dashboard**: High-level stats on top passwords, affected browsers, TLDs, and software.
    
  * **Advanced Search**:
    - **Global Search**: Instantly find credentials by email, domain, or keyword across all logs.
    - **Contextual Pivoting**: A successful match reveals a "Supporting Files" tab with all data from the same device (cookies, history, system files).
    - **Domain Recon**: Enter a domain to discover all related subdomains, paths, and exposed credentials.

  * **Device Detail View**:
    - **Overview**: Summary cards, system info (OS, Hardware), and visualization of data types.
    - **Credentials**: Browse all usernames and passwords associated with the device.
    - **Files**: Explore the complete file structure with a tree viewer.
    - **Software**: List of installed applications.

  * **Debug Utilities**:
    - **Debug-Zip**: Analyze the internal structure of `.zip` files to troubleshoot format issues.
    - **Migration Tools**: Built-in scripts to normalize date formats and fix data inconsistencies.
    
  * **Threat Intelligence Feeds**:
    - Integrated RSS feeds from **ransomware.live** and **malware-traffic-analysis.net**.
  
![alt text](images/Bron-Vault-Search-1.png "Bron Vault Search 1")

![alt text](images/Bron-Vault-Search-2.png "Bron Vault Search 2")

![alt text](images/Bron-Vault-Search-3.png "Bron Vault Search 3")

![alt text](images/Bron-Vault-Search-4.png "Bron Vault Search 4")

![alt text](images/Bron-Vault-Host-Information.png "Bron Vault Host Information")

![alt text](images/Bron-Vault-Device-Overview.png "Bron Vault Device Overview")

![alt text](images/Bron-Vault-Domain-Keyword-Search.png "Bron Vault Domain Search")

-----

## Important Notice

- This tool was built with a focus on functionality, not hardened security. Do **NOT** deploy this in a production environment or expose it to public networks. Use it exclusively in a secure, **isolated** environment.
- Broń Vault was developed by [Tomi Ashari](https://github.com/mastomii) and [YoKo Kho](https://github.com/yokokho) as a side project under the [ITSEC Asia](https://itsec.asia/) RnD Division, with support from AI-assisted tooling. It does not represent our commercial [IntelliBroń Threat Intelligence](https://intellibron.io/) platform.

-----

## Getting Started

### Architecture

Broń Vault utilizes a modern, containerized architecture:

1.  **Next.js App**: The main web interface and API (Node.js 20).
2.  **MySQL 8.0**: Primary transactional database.
3.  **ClickHouse**: Analytical database for high-performance querying, synchronized via MaterializedMySQL.
4.  **Redis**: High-performance job queue for the scanner and background tasks.
5.  **Scanner Worker**: Dedicated service for active asset scanning (ports, SSL, etc.).

### Prerequisites

  * **Docker** and **Docker Compose**
    * Windows/Mac: [Docker Desktop](https://www.docker.com/products/docker-desktop)
    * Linux: `sudo apt-get install docker.io docker-compose`
  * **Git** (to clone the repository)

### Installation & Running

#### 1. Quick Start (Recommended)

The easiest way to run Broń Vault is using the provided start script.

```bash
# Clone the repository
git clone https://github.com/ITSEC-Research/bron-vault
cd bron-vault

# Configure environment
cp .env.example .env
# IMPORTANT: Edit .env and change the default passwords!

# Start all services
# On Linux/macOS:
sudo bash docker-start.sh
```

The `docker-start.sh` script handles building images, setting up the database replication, and launching the services.

#### 2. Access the Application

Once started, access the services at:

- **Web Dashboard:** `http://localhost:3000`
- **ClickHouse Play:** `http://localhost:8123/play`
- **MySQL:** `localhost:3306`

**Default Credentials:**
- **Email:** `admin@bronvault.local`
- **Password:** `admin`
> ⚠️ **Change this password immediately after logging in.**

### Manual / Development Setup

If you wish to contribute or run the application locally (outside of Docker for the frontend):

1.  **Install pnpm**: This project uses `pnpm` for package management.
    ```bash
    npm install -g pnpm
    ```

2.  **Install Dependencies**:
    ```bash
    pnpm install
    ```

3.  **Start Infrastructure**:
    You still need the databases running. You can start just the backing services:
    ```bash
    docker-compose up -d mysql clickhouse redis
    ```

4.  **Run Development Server**:
    ```bash
    pnpm dev
    ```

-----

## Maintenance & Utilities

### Running the Telegram Scraper

The Telegram scraper can be run manually via Docker:

```bash
docker exec -it bronvault_app npm run scraper:telegram
```

For automated scraping, consider adding this command to your system's `crontab`. See [docs/TELEGRAM_SCRAPER.md](docs/TELEGRAM_SCRAPER.md) for full configuration details.

### Data Migration

If you encounter issues with date formats (e.g., legacy data), we provide a migration script to normalize timestamps:

```bash
docker exec -it bronvault_app npm run migrate:dates
```

### Checking Service Status

You can check the health of your container stack using the status script:

```bash
./docker-status.sh
```

-----

## Contributing

We welcome contributions! Please follow these steps:

1.  Fork the repository.
2.  Use **pnpm** for dependency management (`pnpm install`).
3.  Ensure your code passes linting (`pnpm lint`).
4.  Submit a Pull Request with a clear description of your changes.

If you find a security issue, please report it responsibly to the maintainers.
