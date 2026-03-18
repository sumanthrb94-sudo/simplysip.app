import { createSeedMenu, MenuItem } from "../data/menu";

let menuItems: MenuItem[] = createSeedMenu();

export default function handler(req: any, res: any) {
  if (req.method === "GET") {
    res.status(200).json(menuItems);
    return;
  }

  if (req.method === "POST") {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const newItem = {
      id: Date.now().toString(),
      ...body
    };
    menuItems.push(newItem);
    res.status(200).json(newItem);
    return;
  }

  if (req.method === "DELETE") {
    const id = typeof req.query?.id === "string" ? req.query.id : "";
    if (!id) {
      res.status(400).json({ error: "Missing id" });
      return;
    }
    menuItems = menuItems.filter(item => item.id !== id);
    res.status(200).json({ success: true });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
