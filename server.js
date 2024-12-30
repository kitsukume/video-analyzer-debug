const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { spawn } = require('child_process');
const fs = require('fs').promises; // Use promises for file system operations
const app = express();
const port = 3000;
const { Pool } = require('pg');


const pool = new Pool({
    user: 'fox', // Replace with your PostgreSQL user
    host: 'localhost',
    database: 'ai', // Replace with your database name
    password: 'Japanese88/Kitsune', // Replace with your PostgreSQL password
    port: 5432, // Default PostgreSQL port
});

pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1); // Or handle the error differently
});

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.text({ type: 'text/plain' })); // Add text body parser
app.use('/frames', express.static(path.join(__dirname, 'frames')));


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Create an 'uploads' directoryk
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    },
});

const upload = multer({ storage: storage });


async function storeAnalysisResult(filePath, analysisType, analysisData) {
    try {
        const client = await pool.connect();
        const query = `
            INSERT INTO analysis_results (file_path, analysis_type, data)
            VALUES ($1, $2, $3)
            ON CONFLICT (file_path) DO UPDATE SET data = $3, created_at = DEFAULT;
        `;
        await client.query(query, [filePath, analysisType, analysisData]);
        client.release();
        console.log("Analysis results stored in database.");
    } catch (error) {
        console.error("Error storing analysis results:", error);
    }
}



app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.get('/testdb', async (req, res) => {
    try {
        await storeAnalysisResult('test/path', 'test', { test: 'data' });
        res.send('Test data inserted.');
    } catch (error) {
        console.error(error);
        res.status(500).send('Test failed.');
    }
});
// ... other requires

app.post('/process/video', async (req, res) => {
    const videoPath = req.body.videoPath;
    if (!videoPath) {
        return res.status(400).send('No video path provided.');
    }

    const pythonProcess = spawn('python', ['video_processing.py', videoPath]);

    pythonProcess.stdout.on('data', (data) => {
        console.log(`Python script output: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`Python script error: ${data}`);
        return res.status(500).send(`Python script error: ${data}`); // Send error to client
    });

    pythonProcess.on('close', (code) => {
        console.log(`Python script exited with code ${code}`);
        if (code === 0) {
            res.send('Video processing completed.');
        } else {
            res.status(500).send(`Video processing failed with code ${code}.`);
        }
    });
    pythonProcess.on('close', async (code) => {
        if (code === 0) {
            try {
                // Read the json data from the frames folder
                const frameData = [];
                const frameFiles = await fs.readdir("frames")
                for (const file of frameFiles){
                    const results = await fs.readFile(os.path.join("frames", file))
                    frameData.push(JSON.parse(results));
                }
                await storeAnalysisResult(req.body.videoPath, 'video', {frames: frameData});
                res.send('Video processing and data storage completed.');
            } catch (error) {
                console.error("Error reading Frame data", error)
                res.status(500).send("Video processing completed but there was an error saving the data.");
            }
        } else {
            res.status(500).send(`Video processing failed with code ${code}.`);
        }
    });
    pythonProcess.on('close', async (code) => {
        if (code === 0) {
            try {
                const textData = {}
                // parse the console logs from the python script to get the data
                // this is not ideal, but it works for now
                // a better solution would be to have the python script output json
                // or a file that can be read by the nodejs server
                console.log("stdout: ", pythonProcess.stdout)
                await storeAnalysisResult(req.body.textPath, 'text', textData);
                res.send('Text processing and data storage completed.');
            } catch (error) {
                console.error("Error parsing python output", error)
                res.status(500).send("Text processing completed but there was an error saving the data.");
            }
        } else {
            res.status(500).send(`Text processing failed with code ${code}.`);
        }
    });
});



app.post('/process/text', async (req, res) => {
    const textPath = req.body.textPath;

    if (!textPath) {
        return res.status(400).send('No text path provided.');
    }

    const pythonProcess = spawn('python', ['text_processing.py', textPath]);

    pythonProcess.stdout.on('data', (data) => {
        console.log(`Python script output: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`Python script error: ${data}`);
        return res.status(500).send(`Python script error: ${data}`);
    });

    pythonProcess.on('close', async (code) => {
        if (code === 0) {
            try {
                const textData = {}
                // parse the console logs from the python script to get the data
                // this is not ideal, but it works for now
                // a better solution would be to have the python script output json
                // or a file that can be read by the nodejs server
                console.log("stdout: ", pythonProcess.stdout)
                await storeAnalysisResult(req.body.textPath, 'text', textData);
                return res.send('Text processing and data storage completed.');
            } catch (error) {
                console.error("Error parsing python output", error)
                return res.status(500).send("Text processing completed but there was an error saving the data.");
            }
        } else {
            return res.status(500).send(`Text processing failed with code ${code}.`);
        }
    });
    return; // This is the crucial return statement
});

app.post('/upload/text/direct', async (req, res) => {
    const text = req.body;
    if (!text) {
        return res.status(400).send('No text provided.');
    }
    try {
        const timestamp = Date.now();
        const filename = `text_${timestamp}.txt`;
        await fs.writeFile(`uploads/${filename}`, text);
        console.log(`Text saved to: uploads/${filename}`);
        res.send('Text submitted and saved successfully!');
    } catch (error) {
        console.error('Error saving text:', error);
        res.status(500).send('Error saving text.');
    }
});

app.post('/upload/video', upload.single('video'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No video file uploaded.');
    }
    console.log('Video uploaded:', req.file.path);
    res.send('Video uploaded successfully!');
});

app.post('/upload/text', upload.single('text'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No text file uploaded.');
    }
    console.log('Text uploaded:', req.file.path);
    res.send('Text uploaded successfully!');
});

// ... (other requires and code)

app.get('/analysis/video/:filePath', async (req, res) => {
    const filePath = req.params.filePath;
    try {
        const client = await pool.connect();
        const result = await client.query(
            'SELECT data FROM analysis_results WHERE file_path = $1 AND analysis_type = \'video\'',
            [filePath]
        );
        client.release();
        if (result.rows.length > 0) {
            res.json(result.rows[0].data);
        } else {
            res.status(404).send('Analysis data not found.');
        }
    } catch (error) {
        console.error('Error retrieving analysis data:', error);
        res.status(500).send('Error retrieving analysis data.');
    }
});

app.get('/analysis/text/:filePath', async (req, res) => {
    const filePath = req.params.filePath;
    try {
        const client = await pool.connect();
        const result = await client.query(
            'SELECT data FROM analysis_results WHERE file_path = $1 AND analysis_type = \'text\'',
            [filePath]
        );
        client.release();
        if (result.rows.length > 0) {
            res.json(result.rows[0].data);
        } else {
            res.status(404).send('Analysis data not found.');
        }
    } catch (error) {
        console.error('Error retrieving analysis data:', error);
        res.status(500).send('Error retrieving analysis data.');
    }
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});