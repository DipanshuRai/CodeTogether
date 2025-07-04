import { IoLogoJavascript, IoLogoPython } from "react-icons/io5";
import { FaJava, FaPhp, FaCode } from "react-icons/fa";
import { FaC } from "react-icons/fa6";
import { TbBrandCpp, TbBrandTypescript, TbBrandMysql } from "react-icons/tb";
import { PiFileCSharp } from "react-icons/pi";

export const DEFAULT_ICON = FaCode;

export const LANGUAGE_ICONS = {
  c: FaC,
  cpp: TbBrandCpp,
  java: FaJava,
  python: IoLogoPython,
  javascript: IoLogoJavascript,
  typescript: TbBrandTypescript,
  csharp: PiFileCSharp,
  php: FaPhp,
  sql: TbBrandMysql,
};