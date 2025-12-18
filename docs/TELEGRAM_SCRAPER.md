# Telegram Scraper Configuration

Broń Vault includes a powerful Telegram scraper that can monitor channels for stealer logs, automatically download them, and ingest them into the system.

## Prerequisites

To use the Telegram scraper, you need a Telegram API ID and API Hash.

1.  Log in to your Telegram account at [my.telegram.org](https://my.telegram.org).
2.  Go to **API development tools**.
3.  Create a new application (if you haven't already).
4.  Copy the **App api_id** and **App api_hash**.

## Configuration

1.  Log in to the Broń Vault dashboard (`http://localhost:3000`).
2.  Navigate to **Settings** > **General**.
3.  Scroll down to the **Telegram Scraper** section.
4.  Enter your **App ID** and **App Hash**.
5.  Click **Connect**.
6.  You will receive a verification code in your Telegram app. Enter this code in the dialog that appears.
7.  Once verified, the status will change to "Connected".

## Managing Sources

To tell the scraper which channels to monitor:

1.  Navigate to **Sources** in the dashboard sidebar.
2.  Click **Add Source**.
3.  Select **Telegram** as the type.
4.  Enter the **Identifier** (e.g., the channel username like `stealer_logs_free` or the channel ID).
5.  Set the source to **Enabled**.

## Running the Scraper

The scraper is currently designed to be run as a scheduled task or a manual background process. It does not run continuously by default to avoid rate limits and excessive resource usage.

### Running Manually via Docker (Recommended)

You can trigger a scrape cycle by running the script inside the application container:

```bash
docker exec -it bronvault_app npm run scraper:telegram
```

This will:
1.  Connect to Telegram using your configured session.
2.  Iterate through all enabled Telegram sources.
3.  Download new `.zip` or `.txt` files found in the last 20 messages.
4.  Automatically ingest them into Broń Vault.
5.  Exit once complete.

### Setting up a Cron Job

To run the scraper periodically (e.g., every hour), you can add a crontab entry on your host machine:

```bash
# Open crontab
crontab -e

# Add the following line (adjust path as needed)
0 * * * * docker exec bronvault_app npm run scraper:telegram >> /var/log/bronvault-scraper.log 2>&1
```

## Troubleshooting

-   **Authentication Failed**: If the session expires, go back to Settings and reconnect.
-   **Download Errors**: Check the logs using `docker logs bronvault_app` if running in background, or look at the console output if running manually.
-   **Rate Limits**: Telegram has strict rate limits. If you see flood wait errors, decrease the frequency of your cron job.
