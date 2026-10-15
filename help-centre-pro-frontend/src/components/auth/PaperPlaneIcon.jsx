import paperPlane from "../../assets/paper-plane.png";

export default function PaperPlaneIcon({ className = "verify-plane" }) {
  return (
    <img
      className={className}
      src={paperPlane}
      alt=""
      width={280}
      height={194}
      draggable="false"
    />
  );
}
