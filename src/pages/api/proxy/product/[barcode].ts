import { NextApiRequest, NextApiResponse } from "next";
import { apiErrorHandler } from "@/lib/apiErrorHandler";

export default async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { barcode } = req.query;
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
    );
    const data = await response.json();

    if (data.status === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    const { product_name: name, image_front_thumb_url: image } = data.product;
    res.status(200).json({ name, image });
  } catch (error) {
    apiErrorHandler(error, res);
  }
};
