import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
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
    if (!process.env.GOOGLE_DRIVE_CREDENTIALS_JSON) {
        console.warn('⚠️ Google Drive credentials not found in ENV. Skipping...');
        return;
    }

    try {
        const credentials = JSON.parse(process.env.GOOGLE_DRIVE_CREDENTIALS_JSON);
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/drive.file'],
        });

        const drive = google.drive({ version: 'v3', auth });
        const fileMetadata = {
            name: path.basename(filePath),
            parents: [process.env.GOOGLE_DRIVE_FOLDER_ID], // Optional: ID of a folder to upload into
        };
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

/**
 * Push to GitHub
 */
async function uploadToGitHub(filePath) {
    const githubToken = process.env.GITHUB_BACKUP_TOKEN;
    const repoUrl = process.env.GITHUB_BACKUP_REPO; // e.g., github.com/user/backups.git

    if (!githubToken || !repoUrl) {
        console.warn('⚠️ GitHub token or repo not found in ENV. Skipping...');
        return;
    }

    try {
        const fileName = path.basename(filePath);
        console.log(`📤 Pushing ${fileName} to GitHub...`);

        const remoteWithAuth = `https://x-access-token:${githubToken}@${repoUrl}`;

        // Ensure we are in a git repo in the backup folder
        if (!fs.existsSync(path.join(BACKUP_DIR, '.git'))) {
            execSync(`cd ${BACKUP_DIR} && git init && git remote add origin ${remoteWithAuth}`, { stdio: 'inherit' });
        }

        execSync(`cd ${BACKUP_DIR} && git add ${fileName} && git commit -m "Backup: ${fileName}" && git push -u origin main`, { stdio: 'inherit' });

        console.log('✅ GitHub sync successfully completed.');
    } catch (error) {
        console.error('❌ GitHub upload failed:', error.message);
    }
}

async function syncMostRecent() {
    const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse();

    if (files.length === 0) {
        console.error('❌ No backups found to sync.');
        return;
    }

    const latestFile = path.join(BACKUP_DIR, files[0]);
    console.log(`🔄 Syncing latest backup: ${files[0]}`);

    await uploadToDrive(latestFile);
    await uploadToGitHub(latestFile);
}

syncMostRecent();
