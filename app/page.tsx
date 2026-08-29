import type { Metadata } from "next";
import FruitPuddingGame from "./FruitPuddingGame";

export const metadata: Metadata = {
  title: "ぷるぷるフルーツプリン",
  description: "うごくフルーツをタップして、プリンにもりつける5さいからのゲーム",
};

export default function Home() {
  return <FruitPuddingGame />;
}
