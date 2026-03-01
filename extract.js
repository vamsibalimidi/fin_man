const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper function to convert local file to the format required by the API
function fileToGenerativePart(filePath, mimeType) {
    return {
        inlineData: {
            data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
            mimeType,
        },
    };
}

// Ensure you run this with node extract.js <path-to-image/pdf>
async function runExtraction() {
    const filePath = process.argv[2];

    if (!filePath || !fs.existsSync(filePath)) {
        console.error("Please provide a valid file path.");
        console.error("Usage: node extract.js <sample.jpg|sample.pdf>");
        process.exit(1);
    }

    // Determine mime type roughly based on extension
    let mimeType = "image/jpeg";
    if (filePath.toLowerCase().endsWith(".png")) mimeType = "image/png";
    if (filePath.toLowerCase().endsWith(".pdf")) mimeType = "application/pdf";

    try {
        // Instantiate gemini-2.5-flash model and force JSON output
        let modelName = 'gemini-2.5-flash';

        console.log(`Analyzing ${path.basename(filePath)} as ${mimeType}... using model ${modelName}`);

        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
                responseMimeType: "application/json",
            }
        });

        const promptPath = path.join(__dirname, "src", "lib", "prompt.ts");
        const promptRaw = fs.readFileSync(promptPath, "utf8");
        const match = promptRaw.match(/export const GEMINI_PROMPT = \`([\s\S]*?)\`;/);

        if (!match) {
            console.error("Failed to parse unified prompt from src/lib/prompt.ts");
            process.exit(1);
        }
        const prompt = match[1];

        const filePart = fileToGenerativePart(filePath, mimeType);

        // Call the model
        const result = await model.generateContent([prompt, filePart]);
        const response = await result.response;
        const text = response.text();

        // Attempt to format json nicely in the console
        const jsonOutput = JSON.parse(text);
        console.log("\n----- EXTRACTED JSON -----");
        console.log(JSON.stringify(jsonOutput, null, 2));

        // Save to output file. Name should include the model name too. 
        const outputFilename = `extracted_${path.basename(filePath)}_${modelName}.json`;
        fs.writeFileSync(outputFilename, JSON.stringify(jsonOutput, null, 2));
        console.log(`\nResults saved to ${outputFilename}`);

    } catch (err) {
        console.error("Failed to extract data:", err);
    }
}

runExtraction();
