import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKUP_DIR = path.join(__dirname, '../backups');

/**
 * Upload to Google Drive
 */
async function uploadToDrive(filePath) {
    const credentialsPath = process.env.GOOGLE_DRIVE_CREDENTIALS_PATH;

    if (!credentialsPath || !fs.existsSync(credentialsPath)) {
        console.warn('⚠️ Google Drive credentials file not found. Skipping...');
        return;
    }

    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: credentialsPath,
            scopes: ['https://www.googleapis.com/auth/drive.file'],
        });

        const drive = google.drive({ version: 'v3', auth });
        const fileMetadata = {
            name: path.basename(filePath),
        };

        if (process.env.GOOGLE_DRIVE_FOLDER_ID && process.env.GOOGLE_DRIVE_FOLDER_ID !== 'YOUR_DRIVE_FOLDER_ID') {
            fileMetadata.parents = [process.env.GOOGLE_DRIVE_FOLDER_ID];
        }

        const media = {
            mimeType: 'application/json',
            body: fs.createReadStream(filePath),
        };

        const response = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id',
        });

        console.log(`✅ Uploaded to Google Drive. File ID: ${response.data.id}`);
    } catch (error) {
        console.error('❌ Google Drive upload failed:', error.message);
    }
}

async function syncMostRecent() {
    if (!fs.existsSync(BACKUP_DIR)) {
        console.error('❌ Backup directory does not exist.');
        return;
    }

    const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse();

    if (files.length === 0) {
        console.error('❌ No backups found to sync.');
        return;
    }

    const latestFile = path.join(BACKUP_DIR, files[0]);
    console.log(`🔄 Syncing latest backup to Google Drive: ${files[0]}`);

    await uploadToDrive(latestFile);
}

syncMostRecent();
