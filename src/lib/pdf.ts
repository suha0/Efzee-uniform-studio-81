import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate, titleize } from "@/lib/domain";

type OrderSheetInput = {
  order: {
    order_number: string;
    batch_number: string | null;
    order_date: string;
    expected_delivery_date: string | null;
    status: string;
    priority: string;
    product_name: string | null;
    product_category: string | null;
    total_quantity: number;
    fabric_details: string | null;
    accessory_details: string | null;
    customization_details: string | null;
    special_instructions: string | null;
    remarks: string | null;
  };
  customer: {
    customer_name: string;
    organization: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
  } | null;
  items: Array<{
    product_name: string;
    product_type: string | null;
    quantity: number;
    fabric: string | null;
    color: string | null;
    customization: string | null;
    size_quantities: Record<string, number>;
  }>;
  company: {
    company_name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
  };
};

export function generateOrderSheet({ order, customer, items, company }: OrderSheetInput) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(35, 38, 45);
  doc.rect(0, 0, pageWidth, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(company.company_name.toUpperCase(), 12, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    [company.address, company.phone, company.email].filter(Boolean).join("  ·  "),
    12,
    17,
  );
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("PRODUCTION ORDER SHEET", pageWidth - 12, 13, { align: "right" });

  doc.setTextColor(20, 20, 20);

  autoTable(doc, {
    startY: 28,
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 2 },
    headStyles: { fillColor: [245, 245, 242], textColor: 30 },
    head: [["Order details", "", "Customer", ""]],
    body: [
      ["Order No.", order.order_number, "Name", customer?.customer_name ?? "—"],
      ["Batch No.", order.batch_number ?? "—", "Organization", customer?.organization ?? "—"],
      ["Order date", formatDate(order.order_date), "Phone", customer?.phone ?? "—"],
      [
        "Delivery date",
        formatDate(order.expected_delivery_date),
        "Email",
        customer?.email ?? "—",
      ],
      [
        "Status / Priority",
        `${titleize(order.status)} / ${titleize(order.priority)}`,
        "Address",
        [customer?.address, customer?.city, customer?.state].filter(Boolean).join(", ") || "—",
      ],
    ],
  });

  const afterInfo = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  autoTable(doc, {
    startY: afterInfo + 4,
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 2 },
    headStyles: { fillColor: [35, 38, 45], textColor: 255 },
    head: [["Product", "Type", "Fabric", "Colour", "Customization", "Qty", "Size breakdown"]],
    body:
      items.length > 0
        ? items.map((item) => [
            item.product_name,
            item.product_type ?? "—",
            item.fabric ?? "—",
            item.color ?? "—",
            item.customization ?? "—",
            String(item.quantity),
            Object.entries(item.size_quantities ?? {})
              .filter(([, quantity]) => Number(quantity) > 0)
              .map(([size, quantity]) => `${size}:${quantity}`)
              .join("  ") || "—",
          ])
        : [
            [
              order.product_name ?? "—",
              order.product_category ?? "—",
              order.fabric_details ?? "—",
              "—",
              order.customization_details ?? "—",
              String(order.total_quantity),
              "—",
            ],
          ],
  });

  const afterItems = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  autoTable(doc, {
    startY: afterItems + 4,
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 2 },
    headStyles: { fillColor: [245, 245, 242], textColor: 30 },
    head: [["Fabric details", "Accessories", "Special instructions", "Remarks"]],
    body: [
      [
        order.fabric_details ?? "—",
        order.accessory_details ?? "—",
        order.special_instructions ?? "—",
        order.remarks ?? "—",
      ],
    ],
  });

  const afterNotes = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  const signY = Math.min(afterNotes + 22, doc.internal.pageSize.getHeight() - 12);
  doc.setFontSize(8.5);
  const columns = ["Prepared by", "Production in-charge", "Quality check", "Customer approval"];
  const columnWidth = (pageWidth - 24) / columns.length;
  columns.forEach((label, index) => {
    const x = 12 + index * columnWidth;
    doc.line(x, signY, x + columnWidth - 8, signY);
    doc.text(label, x, signY + 5);
  });

  doc.save(`${order.order_number}-order-sheet.pdf`);
}
