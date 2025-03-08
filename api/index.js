import express from 'express';
import mysql from 'mysql2';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
});

db.connect(err => {
    if (err) {
        console.error('Database connection failed:', err);
        process.exit(1);
    }
    console.log('Connected to MySQL');
});

const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const toRad = x => (x * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000;
};

app.post('/addSchool', (req, res) => {
    const { name, address, latitude, longitude } = req.body;

    if (!name || !address || !latitude || !longitude) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return res.status(400).json({ error: 'Latitude and longitude must be numbers' });
    }

    const checkQuery = 'SELECT latitude, longitude FROM schools';
    db.query(checkQuery, (err, results) => {
        if (err) {
            console.error('Error checking existing schools:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        for (const school of results) {
            const distance = calculateDistance(latitude, longitude, school.latitude, school.longitude);
            if (distance < 50) {
                return res.status(400).json({ error: 'A school already exists too close to this location' });
            }
        }

        const insertQuery = 'INSERT INTO schools (name, address, latitude, longitude) VALUES (?, ?, ?, ?)';
        db.query(insertQuery, [name, address, latitude, longitude], (err, result) => {
            if (err) {
                console.error('Error inserting school:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            res.status(201).json({ message: 'School added successfully', schoolId: result.insertId });
        });
    });
});

app.get('/listSchools', (req, res) => {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
        return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const userLat = parseFloat(latitude);
    const userLng = parseFloat(longitude);

    if (isNaN(userLat) || isNaN(userLng)) {
        return res.status(400).json({ error: 'Latitude and longitude must be valid numbers' });
    }

    const query = 'SELECT id, name, address, latitude, longitude FROM schools';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching schools:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        const sortedSchools = results.map(school => ({
            ...school,
            distance: calculateDistance(userLat, userLng, school.latitude, school.longitude)
        })).sort((a, b) => a.distance - b.distance);

        res.json(sortedSchools);
    });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
