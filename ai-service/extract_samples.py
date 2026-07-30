import pdfplumber, os

samples_dir = os.path.join(os.path.dirname(__file__), '..', 'samples')
out_dir = os.path.join(os.path.dirname(__file__), '..', 'tmp_extracts')
os.makedirs(out_dir, exist_ok=True)

for fname in sorted(os.listdir(samples_dir)):
    if not fname.endswith('.pdf'):
        continue
    pdf_path = os.path.join(samples_dir, fname)
    txt_path = os.path.join(out_dir, fname.replace('.pdf', '.txt'))
    with pdfplumber.open(pdf_path) as pdf:
        lines = []
        for i, page in enumerate(pdf.pages):
            t = page.extract_text()
            if t:
                lines.append(f"--- PAGE {i+1} ---\n{t}")
        full = "\n\n".join(lines)
        open(txt_path, 'w', encoding='utf-8').write(full)
        print(f"{fname}: {len(pdf.pages)} pages, {len(full)} chars")
print("Done. Files in:", out_dir)