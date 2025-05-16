const OpenAI = require("openai");
const fs = require('fs-extra');
const axios = require('axios');
const path = require('path');

// Initialize OpenAI client with the API key from environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Transcribe audio using OpenAI's Whisper API
 * @param {string} audioFilePath - Path to the audio file
 * @returns {Promise<string>} - Transcription text
 */
async function transcribeAudio(audioFilePath) {
  try {
    console.log(`Transcribing audio file: ${audioFilePath}`);
    
    // Create a read stream for the audio file
    const fileStream = fs.createReadStream(audioFilePath);
    
    // Call the OpenAI Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: fileStream,
      model: "whisper-1",
      language: "es", // We're using Spanish as the primary language
      response_format: "text", // Get plain text response
    });
    
    console.log("Transcription successful");
    
    // Remove trailing period if it exists
    let cleanedTranscription = transcription;
    if (cleanedTranscription.endsWith('.')) {
      cleanedTranscription = cleanedTranscription.slice(0, -1);
    }
    
    return cleanedTranscription;
  } catch (error) {
    console.error("Error transcribing audio:", error);
    throw error;
  }
}

/**
 * Download voice message from Telegram and transcribe it
 * @param {object} bot - Telegram bot instance
 * @param {string} fileId - Telegram file ID for the voice message
 * @returns {Promise<string>} - Transcription text
 */
async function processVoiceMessage(bot, fileId) {
  try {
    // Create temp directory if it doesn't exist
    const tempDir = path.join(__dirname, '../temp');
    await fs.ensureDir(tempDir);
    
    // Generate a unique filename
    const tempFilePath = path.join(tempDir, `voice_${Date.now()}.ogg`);
    
    // Get file info from Telegram
    const fileInfo = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${fileInfo.file_path}`;
    
    // Download the file
    const response = await axios({
      method: 'GET',
      url: fileUrl,
      responseType: 'stream'
    });
    
    // Save the file
    const writer = fs.createWriteStream(tempFilePath);
    response.data.pipe(writer);
    
    // Wait for the file to be saved
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    
    // Transcribe the audio
    const transcription = await transcribeAudio(tempFilePath);
    
    // Clean up the temp file
    await fs.remove(tempFilePath);
    
    return transcription;
  } catch (error) {
    console.error("Error processing voice message:", error);
    throw error;
  }
}

module.exports = { 
  transcribeAudio,
  processVoiceMessage
};