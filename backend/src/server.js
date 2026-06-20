import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ==========================================
// ENCRYPTION CONFIGURATION
// ==========================================
// IMPORTANT: In production, ENCRYPTION_KEY must be exactly 32 characters.
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "12345678901234567890123456789012"; 
const IV_LENGTH = 16;

function encryptKey(text) {
    let iv = crypto.randomBytes(IV_LENGTH);
    let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptKey(text) {
    let textParts = text.split(':');
    let iv = Buffer.from(textParts.shift(), 'hex');
    let encryptedText = Buffer.from(textParts.join(':'), 'hex');
    let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

// ==========================================
// MONGODB ATLAS CONNECTION
// ==========================================
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ MongoDB Error:', err));

// ==========================================
// MONGODB SCHEMAS & MODELS
// ==========================================
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    lastLogin: { type: Date },
    isVerified: { type: Boolean, default: false },
    verificationToken: String,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    encryptedApiKey: String
});

const TemplateSchema = new mongoose.Schema({
    id: { type: String, required: true }, 
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: String,
    title: String,
    description: String,
    customization: Object,
    sections: Array,
    date: String
});

const DocumentSchema = new mongoose.Schema({
    id: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: String,
    templateId: String,
    templateName: String,
    customization: Object,
    sections: Array,
    date: String,
    updatedAt: String
});

const ActivitySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: String,
    target: String,
    date: String,
    time: String,
    timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Template = mongoose.model('Template', TemplateSchema);
const Document = mongoose.model('Document', DocumentSchema);
const Activity = mongoose.model('Activity', ActivitySchema);

// ==========================================
// AUTHENTICATION MIDDLEWARE
// ==========================================
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Access Denied: No Token Provided." });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Session Expired." });
        req.user = user;
        next();
    });
};

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) return res.status(400).json({ error: "All fields are required" });
        
        const cleanEmail = email.trim().toLowerCase();
        if (await User.findOne({ email: cleanEmail })) return res.status(400).json({ error: "Email address is already in use." });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const verificationToken = crypto.randomBytes(32).toString('hex');

        const newUser = new User({ 
            name: name.trim(), email: cleanEmail, password: hashedPassword,
            isVerified: false, verificationToken: verificationToken
        });
        await newUser.save();

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const verifyUrl = `${frontendUrl}/?verifyToken=${verificationToken}`;

        if (!process.env.SMTP_USER) {
            console.log('\n=============================================================');
            console.log('✉️ EMAIL VERIFICATION LINK GENERATED (Dev Mode)');
            console.log(`📧 To: ${newUser.email}`);
            console.log(`🔗 Link: ${verifyUrl}`);
            console.log('=============================================================\n');
        } else {
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT || 587,
                auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            });
            await transporter.sendMail({
                from: '"DocGen Platform" <no-reply@docgen.com>',
                to: newUser.email,
                subject: 'Verify Your Email Address',
                text: `Welcome! Please verify your email by clicking this link: ${verifyUrl}`,
                html: `<p>Welcome to DocGen Platform!</p><a href="${verifyUrl}">Click here to verify your account.</a>`
            });
        }

        res.json({ message: "Registration successful. Please check your email to verify your account." });
    } catch (e) {
        res.status(500).json({ error: "Server Registration Error." });
    }
});

app.post('/api/auth/verify-email', async (req, res) => {
    try {
        const user = await User.findOne({ verificationToken: req.body.token });
        if (!user) return res.status(400).json({ error: "Invalid or expired verification token." });
        await User.updateOne({ _id: user._id }, { isVerified: true, $unset: { verificationToken: 1 } });
        res.json({ message: "Email verified successfully. You can now log in." });
    } catch (e) { res.status(500).json({ error: "Server Error." }); }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const cleanEmail = email.trim().toLowerCase();
        
        const user = await User.findOne({ email: cleanEmail });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ error: "Invalid email or password." });
        }
        if (user.isVerified === false) {
            return res.status(403).json({ error: "Please verify your email before signing in." });
        }

        await User.updateOne({ _id: user._id }, { lastLogin: new Date() });
        const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '24h' });
        
        const displayName = user.name || user.email.split('@')[0];
        res.json({ token, email: user.email, name: displayName });
    } catch (e) { res.status(500).json({ error: "Server Login Error." }); }
});

app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const cleanEmail = req.body.email.trim().toLowerCase();
        const user = await User.findOne({ email: cleanEmail });
        if (!user) return res.status(400).json({ error: "Email not found." });

        const resetToken = crypto.randomBytes(32).toString('hex');
        await User.updateOne(
            { _id: user._id }, 
            { resetPasswordToken: resetToken, resetPasswordExpires: Date.now() + 15 * 60 * 1000 }
        );

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const resetUrl = `${frontendUrl}/?resetToken=${resetToken}`;

        if (!process.env.SMTP_USER) {
            console.log('\n=============================================================');
            console.log('🔒 PASSWORD RESET LINK GENERATED (Dev Mode)');
            console.log(`📧 To: ${user.email}`);
            console.log(`🔗 Link: ${resetUrl}`);
            console.log('=============================================================\n');
        } else {
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT || 587,
                auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            });
            await transporter.sendMail({
                from: '"DocGen Platform" <no-reply@docgen.com>',
                to: user.email,
                subject: 'Password Reset Request',
                text: `You requested a password reset. Click this link: ${resetUrl}`,
                html: `<p>You requested a password reset.</p><a href="${resetUrl}">Click here to securely reset your password.</a>`
            });
        }

        res.json({ message: "Password reset link sent." });
    } catch (error) { res.status(500).json({ error: "Server Error." }); }
});

app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) return res.status(400).json({ error: "Invalid or expired reset token." });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await User.updateOne(
            { _id: user._id },
            { password: hashedPassword, $unset: { resetPasswordToken: 1, resetPasswordExpires: 1 } }
        );

        res.json({ message: "Password updated successfully." });
    } catch (error) { res.status(500).json({ error: "Server Error." }); }
});

app.delete('/api/auth/delete-account', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        await Template.deleteMany({ userId });
        await Document.deleteMany({ userId });
        await Activity.deleteMany({ userId });
        await User.deleteOne({ _id: userId });
        res.json({ message: "Account deleted successfully." });
    } catch (e) { res.status(500).json({ error: "Failed to delete account." }); }
});

// ==========================================
// USER SETTINGS & DATA ROUTES
// ==========================================
app.get('/api/data', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const templates = await Template.find({ userId: req.user.id }, '-_id -__v -userId');
        const documents = await Document.find({ userId: req.user.id }, '-_id -__v -userId').sort({ updatedAt: -1 });
        const activities = await Activity.find({ userId: req.user.id }, '-_id -__v -userId').sort({ timestamp: -1 }).limit(50);
        
        res.json({ templates, documents, activities, hasApiKey: !!user.encryptedApiKey });
    } catch (e) { res.status(500).json({ error: "Failed to fetch workspace data." }); }
});

app.post('/api/data', authenticateToken, async (req, res) => {
    try {
        const { templates, documents, activities } = req.body;
        const userId = req.user.id;

        if (templates) {
            await Template.deleteMany({ userId });
            if (templates.length > 0) await Template.insertMany(templates.map(t => ({ ...t, userId })));
        }
        if (documents) {
            await Document.deleteMany({ userId });
            if (documents.length > 0) await Document.insertMany(documents.map(d => ({ ...d, userId })));
        }
        if (activities) {
            await Activity.deleteMany({ userId });
            if (activities.length > 0) await Activity.insertMany(activities.map(a => ({ ...a, userId })));
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Database synchronization failed." }); }
});

// Update User's Name
app.post('/api/user/settings/name', authenticateToken, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || typeof name !== 'string') return res.status(400).json({ error: "Name is required." });

        const cleanName = name.trim();
        if (cleanName.length === 0) return res.status(400).json({ error: "Name cannot be empty." });

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: "User not found." });

        user.name = cleanName;
        await user.save();

        res.json({ message: "Name updated successfully.", name: cleanName });
    } catch (e) {
        console.error("Name Update Error:", e);
        res.status(500).json({ error: "Server error while updating name." });
    }
});

// Validate & Save Personal Gemini API Key
app.post('/api/user/settings/api-key', authenticateToken, async (req, res) => {
    try {
        const { apiKey } = req.body;
        if (!apiKey) return res.status(400).json({ error: "API key is required." });

        const cleanKey = apiKey.trim();

        try {
            const testGenAI = new GoogleGenerativeAI(cleanKey);
            const model = testGenAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            await model.generateContent("Respond with the exact word: OK");
        } catch (error) {
            return res.status(400).json({ error: "Invalid Gemini API Key. Please verify and try again." });
        }

        const user = await User.findById(req.user.id);
        user.encryptedApiKey = encryptKey(cleanKey);
        await user.save();

        res.json({ message: "API Key verified and saved securely." });
    } catch (e) {
        console.error("API Key Save Error:", e);
        res.status(500).json({ error: "Server error while saving API key." });
    }
});

// Delete Personal Gemini API Key
app.delete('/api/user/settings/api-key', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: "User not found." });

        await User.updateOne({ _id: user._id }, { $unset: { encryptedApiKey: 1 } });
        res.json({ message: "API Key deleted successfully." });
    } catch (e) {
        console.error("API Key Delete Error:", e);
        res.status(500).json({ error: "Server error while deleting API key." });
    }
});

// ==========================================
// AI & EXPORT ROUTES
// ==========================================
app.post('/api/generate-section', authenticateToken, async (req, res) => {
    try {
        const { prompt, heading, documentTitle } = req.body;
        if(!prompt) throw new Error("Prompt required");

        const user = await User.findById(req.user.id);
        if (!user || !user.encryptedApiKey) {
            return res.status(400).json({ error: "MISSING_API_KEY" });
        }

        const decryptedKey = decryptKey(user.encryptedApiKey);
        const userGenAI = new GoogleGenerativeAI(decryptedKey);
        const model = userGenAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        const systemInstruction = `You are an elite Enterprise Document Architect. Generate content for section: "${heading}" within document: "${documentTitle}". Use pure Markdown.`;
        const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: `${systemInstruction}\n\nRequest: ${prompt}` }] }] });
        res.json({ content: result.response.text() });
    } catch (error) {
        res.status(500).json({ error: error.message || "AI Generation failed." });
    }
});

app.post('/api/export-document', authenticateToken, (req, res) => {
    try {
        const { format = 'docx', documentTitle = 'Document', sections = [], customization = {} } = req.body;
        if (sections.length === 0) return res.status(400).json({ error: 'Cannot export an empty document.' });

        const fileId = crypto.randomUUID();
        const scriptPath = fs.existsSync(path.join(__dirname, '../generate_docx.py')) ? path.join(__dirname, '../generate_docx.py') : path.join(__dirname, 'generate_docx.py');
        const scriptDir = path.dirname(scriptPath); 

        const pythonProcess = spawn('python', [scriptPath, fileId]);
        let outputData = '';
        let errorData = '';

        pythonProcess.stdout.on('data', (data) => { outputData += data.toString(); });
        pythonProcess.stderr.on('data', (data) => { errorData += data.toString(); });

        pythonProcess.on('close', (code) => {
            if (code === 2 && format === 'pdf') {
                return res.status(500).json({ error: 'Unable to generate PDF. Please try again.' });
            }
            if (code !== 0 && code !== 2) {
                return res.status(500).json({ error: 'Unable to export document. Please try again.' });
            }

            const expectedFilename = `${fileId}.${format}`;
            const filePath = path.join(scriptDir, expectedFilename);

            if (fs.existsSync(filePath)) {
                let contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                if (format === 'pdf') contentType = 'application/pdf';
                if (format === 'md') contentType = 'text/markdown';

                res.setHeader('Content-Type', contentType);
                res.setHeader('Content-Disposition', `attachment; filename="DocGen_${documentTitle.replace(/\s+/g, '_')}.${format}"`);
                
                const fileStream = fs.createReadStream(filePath);
                fileStream.pipe(res);
                fileStream.on('end', () => {
                    try { fs.unlinkSync(filePath); } catch(e) {}
                    if (format === 'pdf') {
                        try { fs.unlinkSync(path.join(scriptDir, `${fileId}.docx`)); } catch(e) {}
                    }
                });
            } else {
                res.status(500).json({ error: `Unable to process export file. Please try again.` });
            }
        });

        const payloadStr = JSON.stringify({ format, documentTitle, sections, customization });
        pythonProcess.stdin.write(Buffer.from(payloadStr, 'utf-8'));
        pythonProcess.stdin.end();

    } catch (e) {
        res.status(500).json({ error: "Fatal error in export pipeline." });
    }
});

// Vercel Serverless requirements
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
export default app;