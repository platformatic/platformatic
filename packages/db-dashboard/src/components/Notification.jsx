
export default function Notification (props) {
  const { text } = props
  return (
    <div className='block'>
      {text}
    </div>
  )
}
