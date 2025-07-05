import { load } from 'cheerio';

export interface MassarSummary {
  etablissement: string;
  niveau: string;
  classe: string;
  nbEleves: string;
}

export interface MassarCCRow {
  matiere: string;
  notes: string[];
}

export interface MassarExamRow {
  matiere: string;
  noteCC: string;
  coefficient: string;
  noteMax: string;
  noteMoyClasse: string;
  noteMin: string;
  noteExam: string;
}

export interface MassarGradesParsed {
  summary: MassarSummary;
  ccRows: MassarCCRow[];
  examRows: MassarExamRow[];
  moyenneSession?: string;
  noteExamen?: string;
}

export function parseMassarGrades(html: string): MassarGradesParsed | null {
  const $ = load(html);
  // Summary
  const summary: MassarSummary = {
    etablissement: '',
    niveau: '',
    classe: '',
    nbEleves: ''
  };
  const dts = $('dl dt');
  const dds = $('dl dd');
  dts.each((i, el) => {
    const label = $(el).text().trim();
    const value = $(dds[i]).text().trim();
    if (label.includes('Etablissement')) summary.etablissement = value;
    if (label.includes('Niveau')) summary.niveau = value;
    if (label.includes('Classe')) summary.classe = value;
    if (label.includes('Nombre éléves')) summary.nbEleves = value;
  });

  // Controls Continues Table (tab_cc)
  const ccRows: MassarCCRow[] = [];
  $('#tab_cc table tbody tr').each((_, tr) => {
    const tds = $(tr).find('td');
    const matiere = $(tds[0]).text().trim();
    const notes: string[] = [];
    tds.slice(1).each((_, td) => {
      notes.push($(td).text().trim());
    });
    if (matiere) ccRows.push({ matiere, notes });
  });

  // Exam Table (tab_notes_exam)
  const examRows: MassarExamRow[] = [];
  $('#tab_notes_exam table tbody tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (tds.length >= 7) {
      examRows.push({
        matiere: $(tds[0]).text().trim(),
        noteCC: $(tds[1]).text().trim(),
        coefficient: $(tds[2]).text().trim(),
        noteMax: $(tds[3]).text().trim(),
        noteMoyClasse: $(tds[4]).text().trim(),
        noteMin: $(tds[5]).text().trim(),
        noteExam: $(tds[6]).text().trim(),
      });
    }
  });

  // Session averages
  let moyenneSession = undefined;
  let noteExamen = undefined;
  $('#tab_notes_exam').parent().find('label').each((_, label) => {
    const text = $(label).text().trim();
    if (text.includes('Moyenne session')) moyenneSession = $(label).next('span').text().trim();
    if (text.includes('Note examen')) noteExamen = $(label).next('span').text().trim();
  });

  return { summary, ccRows, examRows, moyenneSession, noteExamen };
}
