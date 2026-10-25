import os
import io
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from app.models import Payslip, CompanySettings


class PDFService:
    @staticmethod
    def generate_payslip_pdf(payslip: Payslip, company_settings: CompanySettings) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36
        )

        elements = []
        styles = getSampleStyleSheet()

        # Styles
        title_style = ParagraphStyle(
            'CompanyTitle',
            parent=styles['Heading1'],
            fontSize=18,
            leading=22,
            textColor=colors.HexColor('#1E293B'),
            fontName='Helvetica-Bold'
        )
        subtitle_style = ParagraphStyle(
            'SubTitle',
            parent=styles['Normal'],
            fontSize=12,
            leading=16,
            textColor=colors.HexColor('#64748B'),
            fontName='Helvetica'
        )
        header_style = ParagraphStyle(
            'SecHeader',
            parent=styles['Heading2'],
            fontSize=12,
            leading=16,
            textColor=colors.HexColor('#0F172A'),
            fontName='Helvetica-Bold'
        )
        cell_style = ParagraphStyle(
            'CellText',
            parent=styles['Normal'],
            fontSize=9,
            leading=12,
            textColor=colors.HexColor('#334155')
        )
        bold_cell_style = ParagraphStyle(
            'BoldCellText',
            parent=styles['Normal'],
            fontSize=9,
            leading=12,
            fontName='Helvetica-Bold',
            textColor=colors.HexColor('#0F172A')
        )

        # Company Header
        elements.append(Paragraph(company_settings.company_name, title_style))
        elements.append(Paragraph(f"PAYSLIP — {payslip.month:02d}/{payslip.year}", subtitle_style))
        elements.append(Spacer(1, 15))

        # Employee Info Table
        emp = payslip.employee
        dept_name = emp.department.name if emp and emp.department else "N/A"
        desig_title = emp.designation.title if emp and emp.designation else "N/A"

        info_data = [
            [Paragraph("Employee Code:", bold_cell_style), Paragraph(emp.employee_code if emp else "", cell_style),
             Paragraph("Department:", bold_cell_style), Paragraph(dept_name, cell_style)],
            [Paragraph("Employee Name:", bold_cell_style), Paragraph(emp.full_name if emp else "", cell_style),
             Paragraph("Designation:", bold_cell_style), Paragraph(desig_title, cell_style)],
            [Paragraph("Working Days:", bold_cell_style), Paragraph(str(payslip.working_days), cell_style),
             Paragraph("Days Worked:", bold_cell_style), Paragraph(f"{payslip.days_worked:.1f}", cell_style)],
        ]
        info_table = Table(info_data, colWidths=[100, 170, 100, 170])
        info_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(info_table)
        elements.append(Spacer(1, 18))

        # Earnings & Deductions Table
        breakdown_data = [
            [Paragraph("<b>EARNINGS</b>", bold_cell_style), Paragraph("<b>AMOUNT (PKR)</b>", bold_cell_style),
             Paragraph("<b>DEDUCTIONS</b>", bold_cell_style), Paragraph("<b>AMOUNT (PKR)</b>", bold_cell_style)],
            [Paragraph("Basic Salary", cell_style), Paragraph(f"{payslip.basic_salary:,.2f}", cell_style),
             Paragraph(f"Absent Days ({payslip.absent_days})", cell_style), Paragraph(f"{float(payslip.total_deductions):,.2f}", cell_style)],
            [Paragraph("House Rent Allowance (HRA 40%)", cell_style), Paragraph(f"{payslip.hra:,.2f}", cell_style),
             Paragraph(f"Unpaid Leave ({payslip.unpaid_leave_days})", cell_style), Paragraph("-", cell_style)],
            [Paragraph("Medical Allowance (10%)", cell_style), Paragraph(f"{payslip.medical_allowance:,.2f}", cell_style),
             Paragraph("Income Tax", cell_style), Paragraph(f"{payslip.tax_deducted:,.2f}", cell_style)],
            [Paragraph("<b>Gross Earnings</b>", bold_cell_style), Paragraph(f"<b>{payslip.gross_salary:,.2f}</b>", bold_cell_style),
             Paragraph("<b>Total Deductions</b>", bold_cell_style), Paragraph(f"<b>{(float(payslip.total_deductions) + float(payslip.tax_deducted)):,.2f}</b>", bold_cell_style)],
        ]
        breakdown_table = Table(breakdown_data, colWidths=[170, 100, 170, 100])
        breakdown_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F1F5F9')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        elements.append(breakdown_table)
        elements.append(Spacer(1, 15))

        # Net Pay Box
        net_data = [
            [Paragraph("<font size=11><b>NET TAKE-HOME PAY:</b></font>", bold_cell_style),
             Paragraph(f"<font size=12 color='#0284C7'><b>PKR {payslip.net_salary:,.2f}</b></font>", bold_cell_style)]
        ]
        net_table = Table(net_data, colWidths=[270, 270])
        net_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#E0F2FE')),
            ('BOX', (0, 0), (-1, -1), 1.5, colors.HexColor('#0284C7')),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ]))
        elements.append(net_table)
        elements.append(Spacer(1, 20))

        # Footer Notice
        footer_style = ParagraphStyle(
            'Footer',
            parent=styles['Normal'],
            fontSize=8,
            textColor=colors.HexColor('#94A3B8'),
            alignment=1
        )
        elements.append(Paragraph("This is a computer-generated payslip from HCM Lite and does not require a physical signature.", footer_style))

        doc.build(elements)
        return buffer.getvalue()
