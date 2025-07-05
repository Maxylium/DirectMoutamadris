import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Container,
  Typography,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  CircularProgress,
  Alert,
  Paper,
  createTheme,
  ThemeProvider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
} from '@mui/material';
import { teal, blue } from '@mui/material/colors';
import axios from 'axios';
import { parseMassarGrades } from '../utils/parseMassarGrades';
import { Chart, registerables } from 'chart.js';
import { saveAs } from 'file-saver';

const theme = createTheme({
  palette: {
    primary: { main: blue[700] },
    secondary: { main: teal[500] },
    background: { default: '#f4fafd' },
  },
});

interface FetchGradesForm {
  username: string;
  password: string;
  semester: string;
  year: string;
}

const FetchGrades: React.FC = () => {
  const [form, setForm] = useState<FetchGradesForm>({
    username: '',
    password: '',
    semester: '1',
    year: '2024/2025',
  });
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<any>(null);
  const chartRef = React.useRef<HTMLCanvasElement | null>(null);

  const yearOptions = [
    '2015/2016',
    '2016/2017',
    '2017/2018',
    '2018/2019',
    '2019/2020',
    '2020/2021',
    '2021/2022',
    '2022/2023',
    '2023/2024',
    '2024/2025',
  ];
  const semesterOptions = [
    { value: '1', label: 'Semester 1' },
    { value: '2', label: 'Semester 2' },
    { value: '3', label: 'Moyenne Annuelle' },
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSelectChange = (
    event: React.ChangeEvent<{ name?: string; value: unknown }> | React.ChangeEvent<HTMLInputElement> | any
  ) => {
    const name = event.target.name as string;
    setForm({ ...form, [name]: event.target.value as string });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setParsed(null);
    try {
      const res = await axios.post('/api/fetch-grades', form);
      setResult(res.data.rawHTML);
      const parsedData = parseMassarGrades(res.data.rawHTML);
      setParsed(parsedData);
    } catch (err: any) {
      if (err.response?.data?.error === 'Login failed') {
        setError('Incorrect Massar code or password. Please try again.');
      } else {
        setError(err.response?.data?.error || 'Something went wrong.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load credentials from localStorage on mount
    const saved = localStorage.getItem('massar-credentials');
    if (saved) {
      try {
        setForm(JSON.parse(saved));
      } catch {}
    }
  }, []);

  useEffect(() => {
    // Save credentials to localStorage on change
    localStorage.setItem('massar-credentials', JSON.stringify(form));
  }, [form]);

  useEffect(() => {
    if (parsed && chartRef.current && parsed.examRows.length > 0) {
      Chart.register(...registerables);
      const ctx = chartRef.current.getContext('2d');
      if (!ctx) return;
      // Destroy previous chart instance if exists
      if ((window as any).massarChart) {
        (window as any).massarChart.destroy();
      }
      (window as any).massarChart = new Chart(ctx, {
        type: 'radar',
        data: {
          labels: parsed.examRows.map((row: any) => row.matiere),
          datasets: [
            {
              label: 'Notes CC',
              data: parsed.examRows.map((row: any) => parseFloat(row.noteCC.replace(',', '.')) || 0),
              backgroundColor: 'rgba(33, 150, 243, 0.2)',
              borderColor: 'rgba(33, 150, 243, 1)',
              borderWidth: 2,
              pointBackgroundColor: 'rgba(33, 150, 243, 1)',
            },
            {
              label: 'Note Moyenne Classe',
              data: parsed.examRows.map((row: any) => parseFloat(row.noteMoyClasse.replace(',', '.')) || 0),
              backgroundColor: 'rgba(0, 150, 136, 0.2)',
              borderColor: 'rgba(0, 150, 136, 1)',
              borderWidth: 2,
              pointBackgroundColor: 'rgba(0, 150, 136, 1)',
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'top' },
            title: { display: true, text: 'Comparatif Notes' },
          },
          scales: {
            r: {
              min: 0,
              max: 20,
              ticks: { stepSize: 2 },
            },
          },
        },
      });
    }
  }, [parsed]);

  function toCSV(rows: any[], headers: string[]): string {
    const escape = (v: string) => '"' + (v || '').replace(/"/g, '""') + '"';
    const csvRows = [headers.map(escape).join(',')];
    for (const row of rows) {
      csvRows.push(headers.map(h => escape(row[h] || '')).join(','));
    }
    return csvRows.join('\n');
  }

  function downloadCSV(parsed: any) {
    if (!parsed) return;
    const examHeaders = [
      'matiere', 'noteCC', 'coefficient', 'noteMax', 'noteMoyClasse', 'noteMin', 'noteExam'
    ];
    const ccHeaders = ['matiere', 'Contrôle 1', 'Contrôle 2', 'Contrôle 3', 'Contrôle 4', 'Activités intégrées'];
    const ccRows = parsed.ccRows.map((row: any) => {
      const out: any = { matiere: row.matiere };
      row.notes.forEach((n: string, i: number) => { out[ccHeaders[i + 1]] = n; });
      return out;
    });
    let csv = 'Notes Controls Continues\n';
    csv += toCSV(ccRows, ccHeaders) + '\n\nNotes Examens\n';
    csv += toCSV(parsed.examRows, examHeaders);
    saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'massar-grades.csv');
  }

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 8, transition: 'background 0.5s' }}>
        <Container maxWidth="md">
          <Paper elevation={6} sx={{ p: 4, borderRadius: 4, boxShadow: 6, transition: 'box-shadow 0.3s', ':hover': { boxShadow: 12 } }}>
            <Typography variant="h3" color="primary" fontWeight={700} gutterBottom align="center" sx={{ letterSpacing: 1 }}>
              Massar Grade Fetcher
            </Typography>
            <Typography variant="subtitle1" color="secondary" align="center" mb={3} sx={{ fontStyle: 'italic' }}>
              Welcome! Enter your Massar credentials to fetch your grades..
            </Typography>
            <Typography variant="subtitle2" color="text.secondary" align="center" mb={2} sx={{ fontSize: 14 }}>
              <b>Note: If massar is truly down, there is nothing this can do for ya</b> 
            </Typography>
            <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Massar Code, Ig:A123456789@taalim.ma"
                name="username"
                value={form.username}
                onChange={handleInputChange}
                variant="outlined"
                required
                fullWidth
                color="primary"
                sx={{ mb: 2 }}
              />
              <TextField
                label="Password"
                name="password"
                type="password"
                value={form.password}
                onChange={handleInputChange}
                variant="outlined"
                required
                fullWidth
                color="primary"
                sx={{ mb: 2 }}
              />
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel id="year-label">Academic Year</InputLabel>
                <Select
                  labelId="year-label"
                  name="year"
                  value={form.year}
                  label="Academic Year"
                  onChange={handleSelectChange}
                  color="secondary"
                >
                  {yearOptions.map((year) => (
                    <MenuItem key={year} value={year}>{year}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel id="semester-label">Semester</InputLabel>
                <Select
                  labelId="semester-label"
                  name="semester"
                  value={form.semester}
                  label="Semester"
                  onChange={handleSelectChange}
                  color="secondary"
                >
                  {semesterOptions.map((s) => (
                    <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                size="large"
                sx={{ mt: 2, borderRadius: 2, fontWeight: 600 }}
                disabled={loading}
                fullWidth
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Fetch Grades'}
              </Button>
            </Box>
            {error && (
              <Alert severity="error" sx={{ mt: 3 }}>{error}</Alert>
            )}
            {parsed && (
              <Box sx={{ mt: 4 }}>
                <Card sx={{ mb: 3, bgcolor: '#e3f2fd', borderRadius: 3, boxShadow: 2, transition: 'box-shadow 0.3s', ':hover': { boxShadow: 6 } }}>
                  <CardContent>
                    <Typography variant="h6" color="primary" fontWeight={600} gutterBottom sx={{ letterSpacing: 0.5 }}>
                      {parsed.summary.etablissement}
                    </Typography>
                    <Typography variant="body1" sx={{ fontSize: 16 }}>
                      <b>Niveau:</b> {parsed.summary.niveau} <br />
                      <b>Classe:</b> {parsed.summary.classe} <br />
                      <b>Nombre élèves:</b> {parsed.summary.nbEleves}
                    </Typography>
                  </CardContent>
                </Card>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Box>
                    <Typography variant="h6" color="secondary" fontWeight={600} gutterBottom>
                      Notes Controls Continues
                    </Typography>
                    <TableContainer component={Paper} sx={{ mb: 3 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Matière</TableCell>
                            <TableCell>Contrôle 1</TableCell>
                            <TableCell>Contrôle 2</TableCell>
                            <TableCell>Contrôle 3</TableCell>
                            <TableCell>Contrôle 4</TableCell>
                            <TableCell>Activités intégrées</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {parsed.ccRows.map((row: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell>{row.matiere}</TableCell>
                              {row.notes.map((note: string, j: number) => (
                                <TableCell key={j}>{note}</TableCell>
                              ))}
                              {Array.from({ length: 5 - row.notes.length }).map((_, k) => (
                                <TableCell key={k + row.notes.length}></TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                  <Box>
                    <Typography variant="h6" color="secondary" fontWeight={600} gutterBottom>
                      Notes Examens
                    </Typography>
                    <TableContainer component={Paper} sx={{ mb: 3 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Matière</TableCell>
                            <TableCell>Notes CC</TableCell>
                            <TableCell>Coefficient</TableCell>
                            <TableCell>Note Max</TableCell>
                            <TableCell>Note Moyenne Classe</TableCell>
                            <TableCell>Note Min</TableCell>
                            <TableCell>Note Examen</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {parsed.examRows.map((row: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell>{row.matiere}</TableCell>
                              <TableCell>{row.noteCC}</TableCell>
                              <TableCell>{row.coefficient}</TableCell>
                              <TableCell>{row.noteMax}</TableCell>
                              <TableCell>{row.noteMoyClasse}</TableCell>
                              <TableCell>{row.noteMin}</TableCell>
                              <TableCell>{row.noteExam}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                </Box>
                <Box sx={{ mt: 2 }}>
                  {parsed.moyenneSession && (
                    <Typography variant="body1" color="primary">
                      <b>Moyenne session:</b> {parsed.moyenneSession}
                    </Typography>
                  )}
                  {parsed.noteExamen && (
                    <Typography variant="body1" color="primary">
                      <b>Note examen:</b> {parsed.noteExamen}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ mt: 4, mb: 2, display: 'flex', justifyContent: 'center', animation: 'fadeIn 1s' }}>
                  <canvas ref={chartRef} width={400} height={400} style={{ maxWidth: '100%' }} />
                </Box>
                <Box sx={{ display: 'flex', gap: 2, mb: 2, justifyContent: 'center' }}>
                  <Button variant="outlined" color="secondary" onClick={() => downloadCSV(parsed)}>
                    Export to CSV
                  </Button>
                  <Button variant="outlined" color="primary" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
                    Scroll to Top 🚀
                  </Button>
                </Box>
              </Box>
            )}
          </Paper>
        </Container>
      </Box>
    </ThemeProvider>
  );
};

export default FetchGrades;
