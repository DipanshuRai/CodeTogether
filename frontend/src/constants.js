export const BASE_URL='http://localhost:5000';

export const LANGUAGE_VERSIONS={
    javascript: "18.15.0",
    typescript: "1.32.3",
    python: "3.10.0",
    java: "15.0.2",
    csharp: "6.12.0",
    php: "8.2.3"
};

export const CODE_SNIPPETS = {
  javascript: `function greet(name) {
  console.log("Hello, " + name + "!");
}

greet("World");`,

  typescript: `function greet(name: string): void {
  console.log(\`Hello, \${name}!\`);
}

greet("World");`,

  python: `def greet(name):
    print(f"Hello, {name}!")

greet("World")`,

  java: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}`,

  csharp: `using System;

class Program {
    static void Main() {
        Console.WriteLine("Hello, World!");
    }
}`,

  php: `<?php
function greet($name) {
    echo "Hello, " . $name . "!";
}

greet("World");
?>`
};
