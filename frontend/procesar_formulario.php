<?php
if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    die("Método no permitido. Asegúrate de que el formulario usa method='POST'.");
}

echo "El formulario se ha enviado correctamente.";
?>

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $nombre = trim($_POST["nombre"]);
    $apellidos = trim($_POST["apellidos"]);
    $email = trim($_POST["email"]);
    $telefono = trim($_POST["telefono"]);
    $mensaje = trim($_POST["mensaje"]);

    // Validaciones básicas
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        die("Correo inválido.");
    }

    // Destinatario
    $para = "gustavo.herraiz@gmail.com";
    $asunto = "Nuevo mensaje de contacto";

    // Cuerpo del mensaje
    $cuerpo = "Has recibido un nuevo mensaje de contacto:\n\n";
    $cuerpo .= "Nombre: $nombre\n";
    $cuerpo .= "Apellidos: $apellidos\n";
    $cuerpo .= "Correo: $email\n";
    $cuerpo .= "Teléfono: $telefono\n";
    $cuerpo .= "Mensaje:\n$mensaje\n\n";
    $cuerpo .= "Enviado desde el formulario de contacto.";

    // Cabeceras para que el correo no se marque como SPAM
    $cabeceras = "From: $email\r\n";
    $cabeceras .= "Reply-To: $email\r\n";
    $cabeceras .= "X-Mailer: PHP/" . phpversion();

    // Enviar correo
    if (mail($para, $asunto, $cuerpo, $cabeceras)) {
        echo "Mensaje enviado correctamente.";
    } else {
        echo "Error al enviar el mensaje.";
    }
}
?>
